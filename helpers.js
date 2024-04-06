// copied from https://github.com/ION-Emotes/plugin/blob/main/getEmotes.js
const { seuser, sesecret } = require('./config.json'),
    sightengine = require('sightengine')(seuser, sesecret),
    fetch = require('node-fetch'),
    request = require('request'),
    nsfwjs = require('nsfwjs'),
    tf = require("@tensorflow/tfjs-node"),
    sharp = require('sharp');


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


/**
 * @deprecated
 * @returns 
 */
async function checkNSFWOld(imgURLRaw) {
    try {
        const imgURL = imgURLRaw.split("?")[0];

        if (await isVideoURL(imgURL)) return { passed: false, reason: 'format', subclass: "can not upload videos!" };
        const classifierResponse = await sightengine.check(['nudity-2.0', 'offensive', 'gore', 'qr-content']).set_url(imgURL);

        // Check nudity fields
        for (let key in classifierResponse.nudity) {
            if (key !== 'suggestive_classes' && key !== 'context' && key !== 'none' && classifierResponse.nudity[key] > 0.60) {
                return { passed: false, reason: 'nudity', subclass: key };
            }
        }

        for (let key in classifierResponse.qr) {
            if (classifierResponse.qr[key].length > 0) {
                return { passed: false, reason: 'qr code', subclass: key };
            }
        }

        // Check offensive, gore, and skull probabilities
        if (classifierResponse.offensive.prob > 0.60) return { passed: false, reason: 'offensive' };
        else if (classifierResponse.gore.prob > 0.60) return { passed: false, reason: 'gore' };
        else if (classifierResponse.skull.prob > 0.60) return { passed: false, reason: 'gore', subclass: key };

        return { passed: true };
    }
    catch (err) {
        console.error(err);
        return { passed: false, reason: "ERROR", subclass: err.message || null };
    }
}


const urlToBuff = function (uri) {
    return new Promise((resolve) => {
        request({uri, encoding: null}, function (err, res, body) {
            if (err) return resolve([err, null]);    
            resolve([null, body]);
        });
    })
};


const nsfwjsPromise = nsfwjs.load();
async function checkNSFW(imgURLRaw) {
    try {
        const model = await nsfwjsPromise;

        // Get the image
        const pathname = imgURLRaw.replace("https://cdn.discordapp.com/emojis/", "");
        const [err, imgBuffRaw] = await urlToBuff(imgURLRaw);

        if (err) {
            console.error(err);
            return false;
        }

        const buffer = (pathname.endsWith(".gif")) ? imgBuffRaw : await sharp(imgBuffRaw)
            .png() // Convert to PNG
            .toBuffer() // Convert to Buffer for tf.node.decodeImage
            .catch((error) => console.error('Error processing image:', error));

        // Decode the image to a tensor
        let imgTensor = tf.node.decodeImage(buffer, 3); // 3 channels for RGB

        // force into 3-channel shape
        if (imgTensor.shape.length === 4) {
            imgTensor = imgTensor.slice([0, 0, 0, 0], [1, imgTensor.shape[1], imgTensor.shape[2], imgTensor.shape[3]]).squeeze([0]);
        }

        const resizedImgTensor = tf.image.resizeBilinear(imgTensor, [224, 224]);

        // If your model expects a batch dimension
        const batchedImgTensor = resizedImgTensor.expandDims(0);

        // Classify the image
        const predictions = await model.classify(batchedImgTensor);
        // console.log("Predictions: ", predictions);

        const safeClassNames = ['Drawing', 'Neutral']
        const detected = predictions.find((o) => (o.probability > 0.5 && !safeClassNames.includes(o.className)));
        imgTensor.dispose();

        return (detected) ? {passed: false, reason: detected.className} : {passed: true};
    }
    catch(err) {
        console.error(err);
        return {passed: false, reason: "ERROR"};
    }
}

module.exports = { groupByFirstLetterOfKey, handleCollisions, reply, checkNSFW };