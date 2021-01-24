/*
This file is part of FFXIV ACT Tools.

FFXIV ACT Tools is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.

FFXIV ACT Tools is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
GNU General Public License for more details.

You should have received a copy of the GNU General Public License
along with FFXIV ACT Tools.  If not, see <https://www.gnu.org/licenses/>.
*/

using System;
using System.IO;
using System.Text;
using System.Text.RegularExpressions;
using System.Net;  
using System.Net.Sockets;  
using System.Threading;  
using System.Threading.Tasks;
using System.Collections.Generic;
using System.Windows.Forms;
using System.Reflection;
using Advanced_Combat_Tracker;

[assembly: AssemblyTitle("FFXIV ACT Tools")]
[assembly: AssemblyDescription("Provides additional functionality to FFXIV ACT parsing.")]
[assembly: AssemblyCompany("Minda Silva @ Sargantanas")]
[assembly: AssemblyVersion("0.01")]

namespace ACT_Plugin
{
    public class FFXIV_ACT_Tools : UserControl, IActPluginV1
    {

        const Int32 VERSION_NUMBER = 1;                         // Version number, much match version number in parse server
        const int LOG_TYPE_MESSAGE = 0x00;                      // Log identifier for chat message.
        const int LOG_TYPE_SINGLE = 0x15;                       // Log identifier for single target attack.
        const int LOG_TYPE_DEFEAT = 0x19;                       // Log identifier for defeated message.
        const int LOG_MESSAGE_COUNTDOWN = 0x00b9;               // Log message identifier for countdown message.
        const UInt16 HTTP_SERVER_PORT = 31594;                  // Port to host webserver on.

        TcpListener webListener;                                // Listener for web requests.
        Thread webThread;                                       // Thread for web requests.
        Regex regexLogDefeat;                                   // Regex for defeated log message.
        private Label lblStatus;                                // The status label that appears in ACT's Plugin tab.
        private string[][] optionList;                          // List of options to be configured.
        private List<System.Windows.Forms.CheckBox> checkboxes; // List of settings checkboxes.
        private System.Windows.Forms.Button openWebBtn;         // Button that opens web page when clicked.
        private Dictionary<int, bool> deathTracker;             // Tracks deaths to determine when party wipe occurs.
        private Dictionary<int, string[]> nameLookupTable;     // Mapping of actor id to act name and log name.
        private string settingFilePath = Path.Combine(          // Path to settings file.
            ActGlobals.oFormActMain.AppDataFolder.FullName,
            "Config\\FFXIV_ACT_Tools.config.dat"
        );

        public FFXIV_ACT_Tools()
        {
            // create option list
            this.optionList = new string[][]{
                new string[]{"end_on_wipe", "End encounter on wipe"},
                new string[]{"end_on_countdown", "End encounter on countdown"},
                new string[]{"web_server", "Export parses to web server at http://localhost:" + HTTP_SERVER_PORT.ToString()},
            };
            // build checkboxes to allow user to select options
            this.checkboxes = new List<System.Windows.Forms.CheckBox>{};
            this.SuspendLayout();
            var y = 0;
            foreach (string[] opt in this.optionList) {
                var label = new System.Windows.Forms.Label();
                label.AutoSize = true;
                label.Location = new System.Drawing.Point(25, 35+(y*28));
                label.Name = opt[0]+"_label";
                label.Size = new System.Drawing.Size(434, 20);
                label.TabIndex = y*2;
                label.Text = opt[1];
                this.Controls.Add(label);
                var checkbox = new System.Windows.Forms.CheckBox();
			    checkbox.Location = new System.Drawing.Point(8, 32+(y*28));
			    checkbox.Name = opt[0];
			    checkbox.Size = new System.Drawing.Size(15, 20);
			    checkbox.TabIndex = (y*2)+1;
                this.checkboxes.Add(checkbox);
                this.Controls.Add(checkbox);
                y++;
            }
            // funny title label
            var titleLabel = new System.Windows.Forms.Label();
            titleLabel.AutoSize = true;
            titleLabel.Location = new System.Drawing.Point(8, 8);
            titleLabel.Name = "title";
            titleLabel.Text = "Uptime ACT Plugin by Minda Silva@Sargatanas";
            this.Controls.Add(titleLabel);
            // open web server button
            this.openWebBtn = new System.Windows.Forms.Button();
            this.openWebBtn.AutoSize = true;
            this.openWebBtn.Location = new System.Drawing.Point(8, 32+(y*32));
            this.openWebBtn.Name = "openWeb";
            this.openWebBtn.Text = "Open Parse Web Page";
            this.openWebBtn.Enabled = true;
            this.Controls.Add(this.openWebBtn);

            // finish building form
			this.AutoScaleDimensions = new System.Drawing.SizeF(6F, 13F);
			this.AutoScaleMode = System.Windows.Forms.AutoScaleMode.Font;
			this.Name = "FFXIV ACT Tools";
			this.Size = new System.Drawing.Size(686, 384);
			this.ResumeLayout(false);
			this.PerformLayout();
            // init death tracker
            this.deathTracker = new Dictionary<int, bool>();
            this.nameLookupTable = new Dictionary<int, string[]>();
            // init regexs
            this.regexLogDefeat = new Regex(
                @" 19:([a-zA-Z0-9'\- ]*) was defeated by [A-Za-z'\- ]*",
                RegexOptions.Compiled
            );
        }

        public void InitPlugin(TabPage pluginScreenSpace, Label pluginStatusText)
        {
            // status label
            lblStatus = pluginStatusText; // Hand the status label's reference to our local var
            // update plugin status text
            lblStatus.Text = "Plugin version " + ((float) VERSION_NUMBER / 100.0).ToString("n2") + " started.";
            // load settings
            loadSettings();
            // hook events
            ActGlobals.oFormActMain.AfterCombatAction += new CombatActionDelegate(this.oFormActMain_AfterCombatAction);
            ActGlobals.oFormActMain.OnLogLineRead += new LogLineEventDelegate(this.oFormActMain_OnLogLineRead);
            foreach (System.Windows.Forms.CheckBox cb in this.checkboxes) {
                cb.CheckedChanged += new EventHandler(this.checkbox_OnChange);
            }
            this.openWebBtn.Click += new EventHandler(this.buttonWebOpen_OnClick);
            // form stuff
			pluginScreenSpace.Controls.Add(this);	// Add this UserControl to the tab ACT provides
			this.Dock = DockStyle.Fill;	// Expand the UserControl to fill the tab's client space
            // set tab title
            foreach (ActPluginData p in ActGlobals.oFormActMain.ActPlugins) {
                if (p.pluginObj == this) {
                    p.tpPluginSpace.Text = "FFXIV ACT Tools";
                }
            }
            // start web server
            this.initWebServer();
        }

        public void DeInitPlugin()
        {
            // deinit event hooks
            ActGlobals.oFormActMain.AfterCombatAction -= this.oFormActMain_AfterCombatAction;
            ActGlobals.oFormActMain.OnLogLineRead  -= this.oFormActMain_OnLogLineRead;
            foreach (System.Windows.Forms.CheckBox cb in this.checkboxes) {
                cb.CheckedChanged -= this.checkbox_OnChange;
            }
            this.openWebBtn.Click -= this.buttonWebOpen_OnClick;
            // stop web server
            this.deinitWebServer();
            // update plugin status text
            lblStatus.Text = "Plugin Exited";
        }

        //
        // ACT EVENT HANDLERS
        //

        void oFormActMain_AfterCombatAction(bool isImport, CombatActionEventArgs actionInfo)
        {
            if (
                actionInfo.cancelAction ||
                !actionInfo.tags.ContainsKey("Job") ||
                (string) actionInfo.tags["Job"] == ""
            ) {
                return;
            }
            // add to death tracker if not already added
            if (actionInfo.tags.ContainsKey("ActorID")) {
                int cId = int.Parse(
                    (string) actionInfo.tags["ActorID"],
                    System.Globalization.NumberStyles.HexNumber
                );
                // add entry to death tracker
                if (!this.deathTracker.ContainsKey(cId)) {
                    this.deathTracker[cId] = false;
                }
                // add entry to name lookup table
                if (!this.nameLookupTable.ContainsKey(cId)) {
                    this.nameLookupTable[cId] = new string[]{
                        actionInfo.attacker, ""
                    };
                }
            }
        }

        void oFormActMain_OnLogLineRead(bool isImport, LogLineEventArgs logInfo)
        {
            if (logInfo.logLine.Length <= 17) {
                return;
            }
            var type = int.Parse(
                logInfo.logLine.Substring(15,2),
                System.Globalization.NumberStyles.HexNumber
            );
            var fields = logInfo.logLine.Substring(16).Split(':');
            switch (type) {
                case LOG_TYPE_DEFEAT: {
                    MatchCollection matches = this.regexLogDefeat.Matches(logInfo.logLine);
                    foreach (Match match in matches) {
                        GroupCollection groups = match.Groups;
                        this.setDeathByName(groups[1].Value.Trim(), true);
                    }
                    break;
                }
                case LOG_TYPE_SINGLE: {
                    var id = int.Parse(
                        fields[1],
                        System.Globalization.NumberStyles.HexNumber
                    );
                    var name = fields[2];
                    if (this.nameLookupTable.ContainsKey(id)) {
                        this.nameLookupTable[id][1] = name;
                    }
                    break;
                }
                case LOG_TYPE_MESSAGE: {
                    var msgType = int.Parse(
                        fields[1],
                        System.Globalization.NumberStyles.HexNumber
                    );
                    switch (msgType) {
                        case LOG_MESSAGE_COUNTDOWN: {
                            //this.lblStatus.Text = "COUNTDOWN RESET";
                            if (this.getSetting("end_on_countdown")) {
                                this.reset();
                            }
                            break;
                        }
                    }
                    break;
                }
            }
            if (this.isWipe() && this.getSetting("end_on_wipe")) {
                //this.lblStatus.Text = "WIPE RESET";
                this.reset();
            }
        }

        void checkbox_OnChange(object sender, System.EventArgs e)
        {
            this.saveSettings();
        }

        void buttonWebOpen_OnClick(object sender, System.EventArgs e)
        {
            this.openWebPage();
        }


        //
        // GENERAL
        //

        void reset() { 
            ActGlobals.oFormActMain.EndCombat(true);
            this.deathTracker.Clear();
            this.nameLookupTable.Clear();
        }

        string getPluginDirectory() {
            foreach (ActPluginData p in ActGlobals.oFormActMain.ActPlugins) {
                if (p.pluginObj == this) {
                    return p.pluginFile.DirectoryName;
                }
            }
            return "";
        }

        //
        // DEATH TRACKER
        //

        string getCombatantNameFromId(int id) {
            if (this.nameLookupTable.ContainsKey(id)) {
                return this.nameLookupTable[id][1];
            }
            return "";
        }

        int getCombatantIdFromName(string name) {
            foreach (int id in this.nameLookupTable.Keys) {
                if (this.nameLookupTable[id][1] == name) {
                    return id;
                }
            }
            return 0;
        }

        void setDeathByName(string name, bool active) {
            foreach (int id in this.nameLookupTable.Keys) {
                if (name == this.nameLookupTable[id][1]) {
                    this.deathTracker[id] = true;
                }
            }
        }

        bool isWipe() {
            if (this.deathTracker.Keys.Count == 0) {
                return false;
            }
            foreach (int id in this.deathTracker.Keys) {
                if (!this.deathTracker[id]) {
                    return false;
                }
            }
            return true;
        }

        //
        // DATA EXPORT
        //

        string exportCombatData() {
            var res = "";
            if (ActGlobals.oFormActMain.ActiveZone == null || ActGlobals.oFormActMain.ActiveZone.ActiveEncounter == null) {
                return "";
            }
            var encounter = ActGlobals.oFormActMain.ActiveZone.ActiveEncounter;
            res += encounter.StartTime.ToString("o") + "|";
            res += encounter.EndTime.ToString("o") + "|";
            res += encounter.ZoneName + "|";
            res += (encounter.Active ? "1" : "0") + "|";
            res += encounter.GetEncounterSuccessLevel().ToString();
            res += "\r\n";
            foreach (CombatantData cd in encounter.GetAllies()) {
                bool hasName = false;
                foreach (var v in this.nameLookupTable.Values) {
                    if (v[0] == cd.Name && v[1] != "") {
                        hasName = true;
                        res += v[1] + "|";
                    }
                }
                if (!hasName) {
                    continue;
                }
                res += cd.GetColumnByName("Job") + "|";
                res += cd.Damage.ToString() + "|";
                res += cd.DamageTaken.ToString() + "|";
                res += cd.Healed.ToString() + "|";
                res += cd.Deaths.ToString() + "|";
                res += cd.Hits.ToString() + "|";
                res += cd.Heals.ToString() + "|";
                res += cd.Kills.ToString() + "|";
                res += cd.CritHits.ToString() + "|";
                res += cd.CritHeals.ToString();
                res += "\r\n";
            }
            return res;
        }

        //
        // SETTINGS
        //

        bool getSetting(string name) {
            foreach (System.Windows.Forms.CheckBox cb in this.checkboxes) {
                if (name == cb.Name && cb.Checked) {
                    return true;
                }
            }
            return false;
        }

        void loadSettings()
        {
            if (!File.Exists(settingFilePath)) {
                return;
            }
            string[] configFlags;
            using (FileStream fs = new FileStream(settingFilePath, FileMode.Open, FileAccess.Read, FileShare.Read))
            {
                using (MemoryStream ms = new MemoryStream())
                {
                    fs.CopyTo(ms);
                    configFlags = Encoding.ASCII.GetString(ms.ToArray()).Split(',');
                }
            }
            foreach (System.Windows.Forms.CheckBox cb in this.checkboxes) {
                cb.Checked = false;
                foreach (string configFlag in configFlags) {
                    if (cb.Name == configFlag) {
                        cb.Checked = true;
                    }
                }
            }
        }

        void saveSettings()
        {
            // build dict of setting flags
            var output = new List<string>();
            foreach (System.Windows.Forms.CheckBox cb in this.checkboxes) {
                if (cb.Checked) {
                    output.Add(cb.Name);
                    // start web server on enable
                    if (cb.Name == "web_server" && !this.openWebBtn.Enabled) {
                        this.initWebServer();
                    }
                // stop web server on disable
                } else if (cb.Name == "web_server" && this.openWebBtn.Enabled) {
                    this.deinitWebServer();
                }
            }
            using (FileStream fs = new FileStream(settingFilePath, FileMode.Create, FileAccess.Write, FileShare.Write))
            {
                var outputBytes = Encoding.ASCII.GetBytes(string.Join(",", output.ToArray()));
                fs.Write(outputBytes, 0, outputBytes.Length);
            }
            this.lblStatus.Text = "Settings saved.";
        }

        //
        // WEB SERVER
        //

        void initWebServer() {
            this.openWebBtn.Enabled = false;
            if (!this.getSetting("web_server")) {
                return;
            }
            try {
                this.webListener = new TcpListener(
                    IPAddress.Parse("0.0.0.0"),
                    HTTP_SERVER_PORT
                );
                this.webListener.Start();
                this.webThread = new Thread(new ThreadStart(this.webListen));
                this.webThread.Start();
                this.openWebBtn.Enabled = true;
            } catch {
                this.lblStatus.Text = "Failed to start web server.";
            }
        }

        void deinitWebServer() {
            this.webThread.Abort();
            this.webListener.Stop();
            this.openWebBtn.Enabled = false;
        }

        void webListen() {

            var webPath = this.getPluginDirectory() + "\\web";
            while (true) {
                try {
                    Socket s = this.webListener.AcceptSocket();  
                    if (!s.Connected) {
                        continue;
                    }
                    // read request
                    var recvBytes = new Byte[8192];
                    s.Receive(recvBytes, recvBytes.Length, 0);
                    var recv = Encoding.ASCII.GetString(recvBytes);
                    if (recv.Trim() == "") {
                        break;
                    }
                    var recvSplit = recv.Split(' ');
                    if (recvSplit.Length < 1) {
                        break;
                    }
                    var path = recvSplit[1];
                    // send response
                    switch (path) {
                        // combat data
                        case "/_fetch": {
                            var sendData = "HTTP/1.1 200 OK\r\n";
                            sendData += "Content-Type: text/plain\r\n";
                            sendData += "\r\n";
                            sendData += this.exportCombatData();
                            var sendBytes = Encoding.ASCII.GetBytes(sendData);
                            s.Send(
                                sendBytes,
                                sendBytes.Length,
                                0
                            );
                            break;
                        }
                        // main app html
                        default: {
                            // determine which file to serve
                            var serveFile = webPath + path.Replace("/", "\\");
                            if (!File.Exists(serveFile)) {
                                serveFile = webPath + "\\app.html";
                            }
                            // determine mime type
                            var mimeType = "text/plain";
                            switch (Path.GetExtension(serveFile)) {
                                case ".html": {
                                    mimeType = "text/html;charset=UTF-8";
                                    break;
                                }
                                case ".css": {
                                    mimeType = "text/css";
                                    break;
                                }
                                case ".js": {
                                    mimeType = "text/javascript";
                                    break;
                                }
                                case ".png": {
                                    mimeType = "image/png";
                                    break;
                                }
                            }
                            // read file                            
                            using (FileStream fs = new FileStream(serveFile, FileMode.Open, FileAccess.Read, FileShare.Read))
                            {
                                using (MemoryStream ms = new MemoryStream())
                                {
                                    fs.CopyTo(ms);
                                    var headerString = "HTTP/1.1 200 OK\r\n";
                                    headerString += "Content-Type: " + mimeType + "\r\n";
                                    headerString += "\r\n";
                                    var headerBytes = Encoding.ASCII.GetBytes(headerString);
                                    var bodyBytes = ms.ToArray();
                                    var sendBytes = new Byte[headerBytes.Length + bodyBytes.Length];
                                    System.Buffer.BlockCopy(headerBytes, 0, sendBytes, 0, headerBytes.Length);
                                    System.Buffer.BlockCopy(bodyBytes, 0, sendBytes, headerBytes.Length, bodyBytes.Length);
                                    s.Send(
                                        sendBytes,
                                        sendBytes.Length,
                                        0
                                    );
                                }
                            }
                            break;
                        }
                    }
                    s.Close();
                } catch {
                }
            }
        }

        void openWebPage() {
            System.Diagnostics.Process.Start("http://localhost:" + HTTP_SERVER_PORT.ToString());
        }

    }
}
 