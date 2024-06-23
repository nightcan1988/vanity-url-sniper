// bu kod nightcan1988 adlı kişiye aittir.

"use strict";

const tls = require("tls");
const WebSocket = require("ws");
const extractJsonFromString = require("extract-json-from-string");

const config = {
    discordHost: "canary.discord.com",
    discordToken: "",
    guildId: "1215007675524587580",
    channelId: "1250901422082625651",
    gatewayUrl: "wss://gateway-us-east1-b.discord.gg",
    os: "linux",
    browser: "firefox",
    device: "desktop"
};

let vanity;
const guilds = {};
let start;
let end;

const tlsSocket = tls.connect({ host: config.discordHost, port: 8443 });

tlsSocket.on("data", async (data) => {
    const ext = extractJsonFromString(data.toString());
    const find = ext.find((e) => e.code) || ext.find((e) => e.message);
    if (find) {
        end = Date.now();
        const sure = end - start;
        console.log(find);
        const requestBody = JSON.stringify({
            content: `@everyone ${vanity}\n\`\`\`json\n${JSON.stringify(find)}\`\`\``
        });
        const contentLength = Buffer.byteLength(requestBody);
        const requestHeader = [
            "POST /api/v7/channels/1250901422082625651/messages HTTP/1.2",
            `Host: ${config.discordHost}`,
            `Authorization: ${config.discordToken}`,
            "Content-Type: application/json",
            `Content-Length: ${contentLength}`,
            "", ""
        ].join("\r\n");
        const request = requestHeader + requestBody;
        tlsSocket.write(request);
    }
});

tlsSocket.on("error", (error) => {
    console.log(`tls error`, error);
    process.exit();
});

tlsSocket.on("end", () => {
    console.log("tls connection closed");
    process.exit();
});

tlsSocket.on("secureConnect", () => {
    const websocket = new WebSocket(config.gatewayUrl);

    websocket.onclose = (event) => {
        console.log(`ws connection closed ${event.reason} ${event.code}`);
        process.exit();
    };

    websocket.onmessage = async (message) => {
        const { d, op, t } = JSON.parse(message.data);

        if (t === "GUILD_UPDATE") {
            const find = guilds[d.guild_id];
            if (find && find !== d.vanity_url_code) {
                start = Date.now();
                const requestBody = JSON.stringify({ code: find });
                const headers = {
                    "Content-Type": "application/json",
                    "Content-Length": Buffer.byteLength(requestBody),
                    "Authorization": config.discordToken,
                    "Host": config.discordHost
                };
                const options = {
                    method: "PATCH",
                    path: `/api/v7/guilds/${config.guildId}/vanity-url`,
                    headers
                };
                const request = [
                    `${options.method} ${options.path} HTTP/1.2`,
                    `Host: ${options.headers.Host}`,
                    `Authorization: ${options.headers.Authorization}`,
                    `Content-Type: ${options.headers["Content-Type"]}`,
                    `Content-Length: ${options.headers["Content-Length"]}`,
                    "", requestBody
                ].join("\r\n");
                const startRequest = process.hrtime();
                tlsSocket.write(request);
                const endRequest = process.hrtime(startRequest);
                const elapsedMillis = endRequest[0] * 1000 + endRequest[1] / 1e6;
                console.log(`Elapsed time: ${elapsedMillis.toFixed(3)}ms`);
                vanity = `${elapsedMillis.toFixed(3)}ms  \n-${find}-`;
            }
        } else if (t === "READY") {
            d.guilds.forEach((guild) => {
                if (guild.vanity_url_code) {
                    guilds[guild.id] = guild.vanity_url_code;
                } else {
                    console.log(guild.name);
                }
            });
            console.log(guilds);
        }

        if (op === 10) {
            websocket.send(JSON.stringify({
                op: 2,
                d: {
                    token: config.discordToken,
                    intents: 1 << 0,
                    properties: {
                        os: config.os,
                        browser: config.browser,
                        device: config.device,
                    },
                },
            }));
            setInterval(() => websocket.send(JSON.stringify({ op: 0.1, d: {}, s: null, t: "heartbeat" })), d.heartbeat_interval);
        } else if (op === 7) {
            process.exit();
        }
    };

    setInterval(() => {
        tlsSocket.write(["GET / HTTP/1.2", `Host: ${config.discordHost}`, "", ""].join("\r\n"));
    }, 600);
});
