FFXIV ACT Tools
===============
**By Chompy / Minda Silva @ Sargatanas**

This ACT plugin provides some additional functional to the FFXIV ACT plugin.

## Installation

1. Download the ACT Plugin. Extract the ZIP. Open ACT and navigate to the plugins tab.
2. Click Browser and locate the 'FFXIV_ACT_Tools.cs' file.
3. Click 'Add/Enable Plugin.'
4. Click on the 'FFXIV ACT Tools' tab. Click all the checkboxes the functionality you wish to use.
5. (Optional) If enabling any of the auto end encounter features you should increase the number of seconds to wait after the last combat action to begin a new encounter" in ACT to a high value such as 120 (2 minutes).


## Features

### Automatically End Encounter on Wipes
When enabled this will end the encounter when all party members are determined to be KO'd. This can have some false positives, such as in UCOB where the party is forcibily KO'd and then revived by Phoenix. In the future I will look to create workarounds for these scenarios.

### Automatically End Encounter on Countdown
When enabled this will end the encounter when countdown timer is started.

### Export Parses to Web Server
When enabled this will start a web server on your local machine and your current parse/encounter data will be available on it. This is useful for displaying your parses in OBS or just having a nice looking parse readout on your second monitor.

### More to come!
I do want to make additional cool features. Some ideas include...
- Better/easier to use UWU Titan gaols plugin.
- Ability to write custom triggers in Lua.
- End encounter on ready check.
- End encounter on clear.
- Push notification when you recieve a tell.
- Push notification when your PF fills.

Got any ideas of your own? Message me on Discord! **Chompy#3436**

## TODO
- Figure out if it's possible to decrease update intervals for web server.