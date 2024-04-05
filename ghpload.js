// for the bot
const { ghtoken } = require('./config.json');
if (!ghtoken) throw "NO GITHUB TOKEN FOUND!";

const axios = require('axios');
const base64 = require('base-64');
const { handleCollisions, groupByFirstLetterOfKey, checkNSFW } = require('./helpers');
const getCDNLink = (id, animated) => `https://cdn.discordapp.com/emojis/${id}.${animated ? "gif" : "webp"}?size=48&quality=lossless`;


const getPR = async (baseURL, serverId, retHTMLURL = false) => {
    try {
        const response = await axios.get(baseURL, {
            headers: { 'Authorization': `Bearer ${ghtoken}` },
            params: {
                state: 'open',
                head: `ION-Emotes:add-${serverId}` // Format is "user:branch"
            }
        });


        if (response.data.length > 0) return (retHTMLURL) ? response.data[0].html_url : response.data[0].url;
        return null;
    }
    catch(err) {
        console.error(err);
        return null;
    }
}

/**
 * Ensures the specified branch is up-to-date with the main branch.
 * @param {String} baseURL
 * @param {String} branchName - The name of the branch to update.
 * @param {String} baseBranch 
 */
async function createOrUpdateBranch(baseURL, branchName, baseBranch = 'main') {
    try {
        // Fetch the latest commit SHA from the base branch (main)
        const baseBranchResponse = await axios.get(`${baseURL}/branches/${baseBranch}`, {
            headers: { 'Authorization': `Bearer ${ghtoken}` }
        });
        const baseSha = baseBranchResponse.data.commit.sha;

        // make sure the branch exists
        await axios.get(`${baseURL}/branches/${branchName}`, {
            headers: { 'Authorization': `token ${ghtoken}` }
        })
        .catch(async (err) => {
            return await axios.post(`${baseURL}/git/refs`, {
                ref: `refs/heads/${branchName}`,
                sha: baseSha
            }, {
                headers: { 'Authorization': `token ${ghtoken}` }
            }).catch(console.error);
        });

        // Check if the feature branch is up-to-date with main
        const featureBranchResponse = await axios.get(`${baseURL}/branches/${branchName}`, {
            headers: { 'Authorization': `Bearer ${ghtoken}` }
        });
        const featureSha = featureBranchResponse.data.commit.sha;

        if (featureSha !== baseSha) {
            // The feature branch is not up-to-date with main, so merge main into the feature branch
            const mergeResponse = await axios.post(`${baseURL}/merges`, {
                base: branchName, // The name of the branch to receive the merge
                head: baseBranch, // The branch to merge into base
                commit_message: `Merge ${baseBranch} into ${branchName}` // Custom merge commit message
            }, {
                headers: { 'Authorization': `Bearer ${ghtoken}` }
            });

            // console.log(`Merged ${baseBranch} into ${branchName}:`, mergeResponse.data);
            return true;
        } else {
            // console.log(`${branchName} is already up-to-date with ${baseBranch}.`);
            return true;
        }
    } catch (error) {
        console.error(`MERGE ERROR FOR BRANCH ${branchName}`);
        console.error(err);
        return false
    }
}


/**
 * @param {{serverId: String, key: String}[]} delObj 
 * @returns 
 */
async function updateJsonFile(path, newData, serverId, toDel = null) {
    if (!newData) return null;
    const baseURL = 'https://api.github.com/repos/ION-Emotes/data';
    const url = `${baseURL}/contents/${path}`;

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
                catch (err) {
                    console.error(err);
                    return false;
                }
            }

            for (const key in newData) {
                r.push({ key, deleted: delMatches(key) });
            }

            if (!changed) return r.map(o => ({ key: o.key, deleted: false }));
        }
        else {
            for (const key in newData) {
                json[key] = newData[key];
                r.push({ key, added: true });
            }
        }

        // Convert the modified JSON back to a string and then to base64
        const newContent = base64.encode(JSON.stringify(json));

        if (toDel) {
            // Prepare the commit
            const updateData = {
                message: `Update emote for ${serverId} via bot`,
                content: newContent,
                sha: response.data.sha
            };

            // Commit the update
            const updateResponse = await axios.put(baseURL, updateData, {
                headers: { 'Authorization': `token ${ghtoken}` }
            });
        }
        else {
            const serverId = Object.values(newData)[0].serverId;
            const newBranchName = `add-${serverId}`;

           const rebased = await createOrUpdateBranch(baseURL, newBranchName);
           if (!rebased) return null;

            const newContent = base64.encode(JSON.stringify(json));
            await axios.put(`${url}`, {
                message: `Update emote for ${serverId} via bot`,
                content: newContent,
                branch: newBranchName,
                sha: response.data.sha  //baseSha
            }, {
                headers: { 'Authorization': `token ${ghtoken}` }
            }).catch(err => {
                console.error(err);
            });

            const prResponse = await axios.post(`${baseURL}/pulls`, {
                title: `Update emote for ${serverId}`,
                head: newBranchName,
                base: 'main',
                body: `submitted for server ${serverId} emotes \`\`\`\n${r.filter(e => e.added).map(e => e.key).join(', ')}\`\`\`\n`,
                // sha: branchResponse.data.sha
            }, {
                headers: { 'Authorization': `token ${ghtoken}`, "Accept": "application/vnd.github+json" }
            });

            // console.log({ pullRequestUrl: prResponse.data.html_url });
        }

        return r;
    } catch (err) {
        console.error(err);
        console.error(err.response.data);
        return null;
    }
}


async function add(newData, serverId) {
    const r = [];

    // check nsfw
    const checked = await Promise.all(newData.map(async (emoji) => [emoji, await checkNSFW(getCDNLink(emoji.id, emoji.animated))]));

    // maybe DM the person who sent the interaction or smth?
    const failed = checked.filter(o => !o[1].passed);

    const succeeded = checked.filter(o => o[1].passed).map(o => o[0]);

    try {
        const dataNew = Object.entries(groupByFirstLetterOfKey(await handleCollisions(newData)));

        for (const [key, val] of dataNew) {
            const path = `data/${key}.json`;
            r.push(...(await updateJsonFile(path, val, serverId)));
        }
        return r;
    }
    catch (err) {
        console.error(err);
    }
}


async function rem(toRem, serverId) {
    const r = [];
    try {
        // formatting
        const formatted = Object.fromEntries(toRem.map(o => [o.name, o]));
        const grouped = Object.entries(groupByFirstLetterOfKey(formatted));

        for (const [key, val] of grouped) {
            const path = `data/${key}.json`;
            r.push(...(await updateJsonFile(path, val, serverId, true)));
        }
    }
    catch (err) {
        console.error(err);
    }
    return r
}


// add([{ id: '1025090058585395231', name: 'ion_bot_old', animated: false, serverId: '533782975079251999' }]);
// rem("ion_bot_old_0", "533782975079251999");

module.exports = { rem, add, getBranch: getPR };
