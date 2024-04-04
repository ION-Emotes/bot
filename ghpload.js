// for the bot
const {ghtoken} = require('./config.json');
if (!ghtoken) throw "NO GITHUB TOKEN FOUND!";

const axios = require('axios');
const base64 = require('base-64');
const { handleCollisions, groupByFirstLetterOfKey } = require('./helpers');


/**
 * @param {{serverId: String, key: String}[]} delObj 
 * @returns 
 */
async function updateJsonFile(path, newData, serverId, toDel = null) {
    if (!newData) return null;
    const url = `https://api.github.com/repos/ION-Emotes/data/contents/${path}`;

    try {
        // Get the current file content
        const response = await axios.get(url, {
            headers: { 'Authorization': `token ${ghtoken}` }
        });

        // Decode the base64 content to a string
        const content = base64.decode(response.data.content);

        let json = JSON.parse(content);

        const r = [];
        let changed = false;
        if (toDel) {
            const testReg = (inp, key) => {
                const pattern = new RegExp(`^${inp}(_\\d+)?$`);
                return pattern.test(key);
            }
            const delMatches = (inp) => {
                try {
                    for (const key in json) {
                        if (testReg(inp, key) && json[key].serverId === newData[inp].serverId && json[key].id === newData[inp].id) {
                            delete json[key];
                            changed = true;
                        }
                    }
                    return true;
                }
                catch(err) {
                    console.error(err);
                    return false;
                }
            }

            for (const key in newData) {
                r.push({key, deleted: delMatches(key)});
            }

            if (!changed) return r.map(o => ({key: o.key, deleted: false}));
        }
        else {
            for (const key in newData) {
                json[key] = newData[key];
                r.push({key, added: true});
            }
        }

        // Convert the modified JSON back to a string and then to base64
        const newContent = base64.encode(JSON.stringify(json));

        // Prepare the commit
        const updateData = {
            message: `Update emote for ${serverId} via bot`,
            content: newContent,
            sha: response.data.sha // SHA of the file you're replacing, to ensure you're updating the right version
        };

        // Commit the update
        const updateResponse = await axios.put(url, updateData, {
            headers: { 'Authorization': `token ${ghtoken}` }
        });

        return r; //{fpath: updateResponse.data.content.html_url};
    } catch (err) {
        console.error(err);
        return null;
    }
}


async function add(newData, serverId) {
    const r = [];

    try {
        const dataNew = Object.entries(groupByFirstLetterOfKey(await handleCollisions(newData)));
    
        for (const [key, val] of dataNew) {
            const path = `data/${key}.json`;
            r.push(...(await updateJsonFile(path, val, serverId)));
        }
        return r;
    }
    catch(err) {
        console.error(err);
    }
}


async function rem(toRem, serverId) {
    const r = [];
    try {
        // formatting
        const formatted =  Object.fromEntries(toRem.map(o => [o.name, o]));
        const grouped = Object.entries(groupByFirstLetterOfKey(formatted));

        for (const [key, val] of grouped) {
            const path = `data/${key}.json`;
            r.push(...(await updateJsonFile(path, val, serverId, true)));
        }
    }
    catch(err) {
        console.error(err);
    }
    return r
}


// add([{ id: '1025090058585395231', name: 'ion_bot_old', animated: false, serverId: '533782975079251999' }]);
// rem("ion_bot_old_0", "533782975079251999");

module.exports = {rem, add};
