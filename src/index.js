const { Client, GatewayIntentBits } = require('discord.js');
const fetch = require('node-fetch');
const noblox = require('noblox.js')

let isMonitoringGameActivity = false;
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ],
});

const getJSON = async (url, args = {}) => {
  try {
    const response = await fetch(url, args);
    if (!response.ok) {
      const responseBody = await response.text(); 
      throw new Error(`HTTP error status: ${response.status}, Body: ${responseBody}`);
    }
    return await response.json();
  } catch (error) {
    console.error('Tried fetching JSON:', error);
    throw error;  
  }
};

const token = 'MTE4NTQyMzEwNzk1NjE2MjU2MA.GDf7ZB.JKKCYrrwRU8tq68S9vN2VfC_EIppgLtpayT7vg';
const channelId = '1186808808174002306';

const USER_PLACE_PAIRS = [
  { userId: '371768392', placeIds: ['15566395852'] }, 

  { userId: '8195210', placeIds: ['2788229376', '3102544766'] },
  { userId: '93101606', placeIds: ['2788229376', '3102544766'] },
  { userId: '163721789', placeIds: ['2788229376', '3102544766'] },
  { userId: '5273893787', placeIds: ['2788229376', '3102544766'] },
];

client.on('ready', () => {
  console.log(`Logged in as ${client.user.tag}!`);
  setInterval(monitorGameActivity, 15000);
});

async function getThumb(id) {
  try {
    const response = await getJSON(
      `https://thumbnails.roblox.com/v1/users/avatar-headshot?userIds=${id}&format=Png&size=150x150`
    );
    return response.data[0].imageUrl;
  } catch (error) {
    console.error('Error:', error);
    return null;
  }
}

async function getServer(placeId, cursor) {
  let url = `https://games.roblox.com/v1/games/${placeId}/servers/Public?limit=100`;
  if (cursor) url += "&cursor=" + cursor;

  try {
    return await getJSON(url);
  } catch (error) {
    console.error('Error:', error);
    return null;
  }
}

async function fetchThumbs(tokens) {
  let body = tokens.map(token => ({
      requestId: `0:${token}:AvatarHeadshot:150x150:png:regular`,
      type: "AvatarHeadShot",
      targetId: 0,
      token,
      format: "png",
      size: "150x150",
  }));

  const requestBody = JSON.stringify(body);

  try {
      return await getJSON("https://thumbnails.roblox.com/v1/batch", {
          method: "POST",
          headers: {
              "Content-Type": "application/json",
              Accept: "application/json",
          },
          body: requestBody,
      });
  } catch (error) {
      console.error('Error:', error, 'Request Body:', requestBody);
      return null;
  }
}

async function monitorGameActivity() {
  if (isMonitoringGameActivity) {
    console.log('Already in progress');
    return;
  }

  isMonitoringGameActivity = true;

  for (const userPlacePair of USER_PLACE_PAIRS) {
    const { userId, placeIds } = userPlacePair;
    for (const placeId of placeIds) {
      const { hasJoined, serverId } = await hasUserJoinedGame(userId, placeId);
  
      if (hasJoined) {
        let UsernameRetrieve = await noblox.getUsernameFromId(userId);
        let cleanedServerId = serverId.replace(/"/g, '');

        const message = `@everyone \n🎉 **${UsernameRetrieve}** has joined!\n🎮 Join URL: \`roblox://experiences/start?placeId=${placeId}&gameInstanceId=${cleanedServerId}\``;
        sendMessageToChannel(message);
      }
  
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }

  isMonitoringGameActivity = false;
}

async function ReturnGameName(placeid) {
  try {
    const response = await getJSON(
      `https://games.roblox.com/v1/games/multiget-place-details?placeIds=${placeid}`
    );

    console.log("API Response:", JSON.stringify(response, null, 2));

    if (response && response.data && response.data.length > 0 && response.data[0].name) {
      return response.data[0].name;
    } else {
      console.log("No valid game name found in the response");
    }
  } catch (error) {
    console.error('Error:', error);
  }

  return "Untitled Deleted"; 
}

async function hasUserJoinedGame(userId, placeId) {
  await new Promise(resolve => setTimeout(resolve, 1000));

  try {
    const userThumbUrl = await getThumb(userId);

    let cursor = null;
    let servers = await getServer(placeId, cursor);

    while (servers && servers.data.length > 0) {
      for (const server of servers.data) {
        let playerTokens = server.playerTokens;
        let serverThumbs = await fetchThumbs(playerTokens);

        if (serverThumbs && serverThumbs.data) {
          if (serverThumbs.data.some(thumb => thumb.imageUrl === userThumbUrl)) {
            return { hasJoined: true, serverId: JSON.stringify(server.id, null, 2) };
          }
        }
      }

      cursor = servers.nextPageCursor;
      if (!cursor) break;
      servers = await getServer(placeId, cursor);
    }
  } catch (error) {
    console.error('Error:', error);
  }

  return { hasJoined: false, serverId: null };
}

async function sendMessageToChannel(messageContent) {
  try {
    const channel = await client.channels.fetch(channelId);
    await channel.send(messageContent);
  } catch (error) {
    console.error('Cant send to the channel:', error);
  }
}

client.login(token);