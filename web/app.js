const IMG_URL_PREFIX = "/img/";
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
var currentEncTime = -1;
var currentEncActive = false;
var timeout = null;
var timerTimeout = null;

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
    ENCOUNTER_ELEMENT.appendChild(ENCOUNTER_ELEMENTS.time);
    updateTimer();
    // player list div
    var playerEle = document.createElement("div");
    playerEle.id = "players";
    playerEle.className = "players";
    document.getElementById("app").appendChild(playerEle);
    // begin polling for data
    poll();
    tickTimer();
}

function poll() {
    if (timeout) {
        clearTimeout(timeout);
    }
    fetch();
    timeout = setTimeout(poll, 2500);
}

function reset() {
    document.getElementById("players").innerHTML = "";
    currentEncTime = -1;
}

function updateTimer() {
    if (currentEncTime < 0) {
        ENCOUNTER_ELEMENTS.time.innerText = "--:--";
        return;
    }
    var seconds = currentEncTime % 60;
    var minutes = Math.floor(currentEncTime / 60);
    ENCOUNTER_ELEMENTS.time.innerText = (minutes < 10 ? "0": "") + minutes + ":" + (seconds < 10 ? "0" : "") + seconds;
}

function tickTimer() {
    if (timerTimeout) {
        clearTimeout(timerTimeout);
    }
    if (currentEncTime >= 0 && currentEncActive) {
        currentEncTime++;
        updateTimer();
    }
    setTimeout(tickTimer, 1000);
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
    currentEncActive = false;
    if (data.encounter[ENC_ACTIVE] == "1") {
        ENCOUNTER_ELEMENT.classList.add("active");
        ENCOUNTER_ELEMENTS.state.innerText = "active";
        currentEncActive = true;
    }
    // update zone name
    ENCOUNTER_ELEMENTS.zone.innerText = data.encounter[ENC_ZONE];
    // update time
    var startTime = new Date(Date.parse(data.encounter[ENC_START]))
    var endTime = new Date(Date.parse(data.encounter[ENC_END]));
    var diff = (endTime - startTime) / 1000;
    if (diff < 0) { 
        diff = 0;
    }
    if (currentEncTime < diff || !currentEncActive) {
        currentEncTime = diff;
        updateTimer();
    }
}

function updateCombatants(data) {
    data.combatants.sort(function(a, b) {
        return parseInt(a[COMB_DAMAGE]) < parseInt(b[COMB_DAMAGE]) ? 1 : -1;
    });
    for (var i = 0; i < data.combatants.length; i++) {
        updateCombatant(data.combatants[i], i+1);
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

function sanitizeNumeric(value) {
    if (isNaN(value)) {
        return 0;
    }
    return value;
}

function updateCombatant(data, sort) {
    if (!data || !data[COMB_NAME]) {
        return;
    }
    var nameId = data[COMB_NAME].toLowerCase().replace(" ", "-").replace("'", "");
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
        jobEle.className = "job-img";
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
    element.style.order = sort;
    element.style.webkitOrder = sort;

    // update job
    var jobEle = element.getElementsByClassName("job-img")[0];
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
    damageEle.innerText = sanitizeNumeric(data[COMB_DAMAGE] / currentEncTime).toFixed(2);
    damageEle.title = damageEle.innerText + " damage per second (" + data[COMB_DAMAGE] + " total damage).";
    // update healing
    var healingEle = element.getElementsByClassName("healing")[0];
    healingEle.innerText = sanitizeNumeric(data[COMB_HEALED] / currentEncTime).toFixed(2);
    healingEle.title = healingEle.innerText + " healing per second (" + data[COMB_HEALED] + " total healing).";
    // update deaths
    var deathEle = element.getElementsByClassName("deaths")[0];
    deathEle.innerText = sanitizeNumeric(data[COMB_DEATHS]);
    deathEle.title = sanitizeNumeric(data[COMB_DEATHS]) + " deaths.";
    // update crit hits
    var critEle = element.getElementsByClassName("critical-hits")[0];
    var critPerc = sanitizeNumeric((data[COMB_CRIT] / data[COMB_HITS]) * 100).toFixed(1);
    if (data[COMB_CRIT] <= 0) {
        critPerc = "0.0";
    }
    critEle.innerText = critPerc + "%";
    critEle.title + critEle.innerText + " critical hits (" + data[COMB_CRIT] + " out of " + data[COMB_HITS] + ").";
    // update crit heals
    var critHeals = element.getElementsByClassName("critical-heals")[0];
    critPerc = sanitizeNumeric((data[COMB_CRIT_HEAL] / data[COMB_HEALS]) * 100).toFixed(1);
    if (data[COMB_CRIT_HEAL] <= 0) {
        critPerc = "0.0";
    }
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
            if (data[i].indexOf("Shadow Of A Hero") != -1) {
                continue;
            }
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