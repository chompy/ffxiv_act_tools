const IMG_URL_PREFIX = "https://raw.githubusercontent.com/chompy/ffxiv_act_tools/main/web/img/";
const FETCH_URL = "/_fetch";
const ENC_START = 0;
const ENC_END = 1;
const ENC_ZONE = 2;
const ENC_ACTIVE = 3;
const ENC_SUCCESS = 4;
const COMB_NAME = 0;
const COMB_JOB = 1;
const COMB_DAMAGE = 2;
const COMB_DAMAGE_TAKEN = 3;
const COMB_HEALED = 4;
const COMB_DEATHS = 5;
const COMB_HITS = 6;
const COMB_HEALS = 7;
const COMB_KILLS = 8;
const COMB_CRIT = 9;
const COMB_CRIT_HEAL = 10;
const ROLE_TANK = "tank";
const ROLE_HEALER = "healer";
const ROLE_DPS = "dps";
var ROLE_TABLE = {
    [ROLE_HEALER]: ["sch", "whm", "ast"],
    [ROLE_TANK]: ["war", "drk", "gnb", "pld"]
};
var ENCOUNTER_ELEMENT = document.createElement("div");
var ENCOUNTER_ELEMENTS = {
    "zone" : document.createElement("span"),
    "state" : document.createElement("span"),
    "time" : document.createElement("span")
}
var PLAYER_ELEMENT = document.createElement("div");
var currentEncounter = "";
var encounterSeconds = 0;
var timeout = null;

function init() {
    // setup encounter elment
    ENCOUNTER_ELEMENT.className = "encounter";
    document.getElementById("app").appendChild(ENCOUNTER_ELEMENT);
    // -- zone
    ENCOUNTER_ELEMENTS.zone.className = "zone"
    ENCOUNTER_ELEMENTS.zone.innerText = "-";
    ENCOUNTER_ELEMENT.appendChild(ENCOUNTER_ELEMENTS.zone);
    // -- state
    ENCOUNTER_ELEMENTS.state.className = "state";
    ENCOUNTER_ELEMENTS.state.innerText = "inactive";
    ENCOUNTER_ELEMENT.appendChild(ENCOUNTER_ELEMENTS.state);
    // -- time
    ENCOUNTER_ELEMENTS.time.className = "time";
    ENCOUNTER_ELEMENTS.time.innerText = "--:--";
    ENCOUNTER_ELEMENT.appendChild(ENCOUNTER_ELEMENTS.time);
    // player list div
    var playerEle = document.createElement("div");
    playerEle.id = "players";
    playerEle.className = "players";
    document.getElementById("app").appendChild(playerEle);
    // begin polling for data
    poll();
}

function poll() {
    if (timeout) {
        clearTimeout(timeout);
    }
    fetch();
    timeout = setTimeout(poll, 1000);
}

function reset() {
    document.getElementById("players").innerHTML = "";
}

function updateEncounter(data) {
    // reset
    if (data.encounter[ENC_START] != currentEncounter) {
        reset();
        currentEncounter = data.encounter[ENC_START]
    }
    // set active state
    ENCOUNTER_ELEMENT.classList.remove("active");
    ENCOUNTER_ELEMENTS.state.innerText = "inactive";
    if (data.encounter[ENC_ACTIVE] == "1") {
        ENCOUNTER_ELEMENT.classList.add("active");
        ENCOUNTER_ELEMENTS.state.innerText = "active";
    }
    // update zone name
    ENCOUNTER_ELEMENTS.zone.innerText = data.encounter[ENC_ZONE];
    // update time
    var startTime = new Date(Date.parse(data.encounter[ENC_START]))
    var endTime = new Date(Date.parse(data.encounter[ENC_END]));
    var diff = (endTime - startTime) / 1000;
    var seconds = diff % 60;
    var minutes = Math.floor(diff / 60);
    ENCOUNTER_ELEMENTS.time.innerText = (minutes < 10 ? "0": "") + minutes + ":" + (seconds < 10 ? "0" : "") + seconds;
    encounterSeconds = diff;
}

function updateCombatants(data) {
    for (var i in data.combatants) {
        updateCombatant(data.combatants[i]);
    }
}

function buildColumn(rows) {
    var element = document.createElement("div");
    element.className = "col";
    for (var i in rows) {
        var rowElement = document.createElement("div");
        rowElement.className = "row";
        element.appendChild(rowElement)
        for (var j in rows[i]) {
            var valElement = document.createElement("div");
            valElement.className = "value " + rows[i][j];
            valElement.innerText = "-";
            rowElement.appendChild(valElement);
        }
    }
    return element;
}

function updateCombatant(data) {

    var nameId = data[COMB_NAME].toLowerCase().replaceAll(" ", "-").replaceAll("'", "");
    var element = document.getElementById("player-" + nameId);
    // create new element if not exists
    if (!element) {
        // create main element
        element = document.createElement("div");
        element.id = "player-" + nameId;
        element.className = "player job-" + data[COMB_JOB].toLowerCase() + " role-" + getCombatantRole(data) + " alive";
        document.getElementById("players").appendChild(element);
        // -- column 1
        var colOneEle = document.createElement("div");
        colOneEle.className = "value col job job-" + data[COMB_JOB].toLowerCase();
        element.appendChild(colOneEle);
        // --- job
        var jobEle = document.createElement("img")
        jobEle.className = "job";
        colOneEle.appendChild(jobEle);
        // -- column 2
        var colTwoEle = buildColumn([
            ["name"], ["damage"]
        ]);
        element.appendChild(colTwoEle);
        // -- column 3
        var colThreeEle = buildColumn([
            ["healing", "deaths"]
        ]);
        element.appendChild(colThreeEle);
        // -- column 4
        var colFourEle = buildColumn([
            ["critical-hits", "critical-heals"]
        ]);
        element.appendChild(colFourEle);
    }
    // update job
    var jobEle = element.getElementsByClassName("name")[0];
    jobEle.title = data[COMB_JOB].toLowerCase();
    if (!jobEle.title) {
        jobEle.title = "lb";
    }
    jobEle.alt = jobEle.title;
    jobEle.src = IMG_URL_PREFIX + "jobs/" + jobEle.title + ".png";
    // update name
    var nameEle = element.getElementsByClassName("name")[0];
    nameEle.innerText = data[COMB_NAME];
    nameEle.title = nameEle.innerText;
    // update damage
    var damageEle = element.getElementsByClassName("damage")[0];
    damageEle.innerText = (data[COMB_DAMAGE] / encounterSeconds).toFixed(2);
    damageEle.title = damageEle.innerText + " damage per second (" + data[COMB_DAMAGE] + " total damage).";
    // update healing
    var healingEle = element.getElementsByClassName("healing")[0];
    healingEle.innerText = (data[COMB_HEALED] / encounterSeconds).toFixed(2);
    healingEle.title = healingEle.innerText + " healing per second (" + data[COMB_HEALED] + " total healing).";
    // update deaths
    var deathEle = element.getElementsByClassName("deaths")[0];
    deathEle.innerText = data[COMB_DEATHS];
    deathEle.title = data[COMB_DEATHS] + " deaths.";
    // update crit hits
    var critEle = element.getElementsByClassName("critical-hits")[0];
    var critPerc = ((data[COMB_CRIT] / data[COMB_HITS]) * 100).toFixed(1);
    critEle.innerText = critPerc + "%";
    critEle.title + critEle.innerText + " critical hits (" + data[COMB_CRIT] + " out of " + data[COMB_HITS] + ").";
    // update crit heals
    var critHeals = element.getElementsByClassName("critical-heals")[0];
    critPerc = ((data[COMB_CRIT_HEAL] / data[COMB_HEALS]) * 100).toFixed(1);
    critHeals.innerText = critPerc + "%";
    critHeals.title + critHeals.innerText + " critical heals (" + data[COMB_CRIT_HEAL] + " out of " + data[COMB_HEALS] + ").";
}

function getCombatantRole(data) {
    for (var i in ROLE_TABLE) {
        if (ROLE_TABLE[i].indexOf(data[COMB_JOB].toLowerCase()) != -1) {
            return i;
        }
    }
    return ROLE_DPS;
}

function parse(data) {
    data = data.split("\r\n");
    var encounter = data[0].split("|");
    var combatants = [];
    if (data.length > 1) {
        for (let i = 1; i < data.length; i++) {
            if (!data[i]) { continue; }
            combatants.push(data[i].split("|"));
        }
    }
    return {
        "encounter": encounter,
        "combatants": combatants
    };
}

function fetch() {
    var xhttp = new XMLHttpRequest();
    xhttp.onreadystatechange = function() {
        if (this.readyState == 4) {
            if (!this.responseText.trim()) {
                return;
            }
            var data = parse(this.responseText);
            updateEncounter(data);
            updateCombatants(data);
        }
    };
    xhttp.open("GET", FETCH_URL, true);
    xhttp.send();
}

window.onload = init;