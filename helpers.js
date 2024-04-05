// copied from https://github.com/ION-Emotes/plugin/blob/main/getEmotes.js
const { seuser, sesecret } = require('./config.json');
const sightengine = require('sightengine')(seuser, sesecret);
const fetch = require('node-fetch');

const reply = (interaction, toSend) => interaction.editReply(toSend).catch((_) => interaction.channel.send(toSend));

async function handleCollisions(data) {
    const o = {};

    for (const obj of data) {
        let { name } = obj;
        let i = 0;
        name = name.toLowerCase();

        // get the corresponding file in the db
        const res = await fetch(`https://raw.githubusercontent.com/ION-Emotes/data/main/data/${name[0]}.json`);
        const data = await res.json();
        const keys = Object.keys(data);

        if (name in o || keys.find((eName) => (eName == name))) {
            while (`${name}_${i}` in o) { i++; }
            name += `_${i}`;
        }

        const nOld = obj.name;
        delete obj.name;
        obj.oldName = nOld;
        o[name] = obj;
    }

    return o;
}

function groupByFirstLetterOfKey(items) {
    if (!items) return console.error("ITEMS NOT FOUND!");

    const grouped = {};

    // Iterate over each key in the object
    Object.keys(items).forEach(key => {
        const firstLetter = key[0];

        if (!grouped[firstLetter]) {
            grouped[firstLetter] = {};
        }

        // Add the current property to the group corresponding to its first letter
        grouped[firstLetter][key] = items[key];
    });

    return grouped;
}


// "https://cdn.discordapp.com/emojis/1181859475422986301.gif"
const hasVideoExtension = (url) => {
    const pathname = new URL(url).pathname;
    return ['.mp4', '.mkv', '.webm', '.avi', '.mov'].some(extension => pathname.endsWith(extension));
}

async function isVideoURL(url) {
    // check if the URL ends with a known video file extension
    if (hasVideoExtension(url)) return false;

    // make a HEAD request to check the Content-Type
    try {
        const response = await fetch(url, { method: 'HEAD' });
        const contentType = response.headers.get('Content-Type');

        if (contentType && contentType.startsWith('video/')) return true;
        else return false;
    } catch (err) {
        console.error(err);
        return true;
    }
}


async function checkNSFW(imgURLRaw) {
    try {
        const imgURL = imgURLRaw.split("?")[0];

        if (await isVideoURL(imgURL)) return {passed: false, reason: 'format', subclass: "can not upload videos!"};
        const classifierResponse = await sightengine.check(['nudity-2.0', 'offensive', 'gore', 'qr-content']).set_url(imgURL);

        // Check nudity fields
        for (let key in classifierResponse.nudity) {
            if (key !== 'suggestive_classes' && key !== 'context' && key !== 'none' && classifierResponse.nudity[key] > 0.60) {
                return {passed: false, reason: 'nudity', subclass: key};
            }
        }
        
        for (let key in classifierResponse.qr) {
            if (classifierResponse.qr[key].length > 0) {
                return {passed: false, reason: 'qr code', subclass: key};
            }
        }

        // Check offensive, gore, and skull probabilities
        if (classifierResponse.offensive.prob > 0.60) return {passed: false, reason: 'offensive'};
        else if (classifierResponse.gore.prob > 0.60) return {passed: false, reason: 'gore'};
        else if (classifierResponse.skull.prob > 0.60) return {passed: false, reason: 'gore', subclass: key};

        return {passed: true};
    }
    catch (err) {
        console.error(err);
        return {passed: false, reason: "ERROR", subclass: err.message || null};
    }
}

module.exports = { groupByFirstLetterOfKey, handleCollisions, reply, checkNSFW };