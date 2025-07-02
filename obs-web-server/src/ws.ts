import WebSocket from 'ws';
import { URL } from 'url';
import wss from './http';
import { createHash, randomBytes } from 'crypto';

var allWS: {
    Pseudo: string,
    Password: string,
    OBSVersion: string,
    ws: WebSocket,
    wsDest: WebSocket[]
}[] = [];

function removeThisObsWs(ws: WebSocket) {
    const connected = allWS.find(e => e.ws === ws);
    if (connected) {
        console.log('🌐 Déconnexion de l\'OBS:', connected.Pseudo);
        for (let i = 0; i < connected.wsDest.length; i++) {
            connected.wsDest[i].close(4011, "Your session has been invalidated.");
        }
    }
    allWS = allWS.filter(e => e.ws !== ws);
}

function removeThisToObsWs(ws: WebSocket) {
    for (let i = 0; i < allWS.length; i++) {
        allWS[i].wsDest = allWS[i].wsDest.filter(e => e !== ws);
    }
}

function sha256base64(data: string): string {
    return createHash('sha256').update(data).digest('base64');
}

function initWs() {
    wss.on('connection', (clientSocket: WebSocket, req) => {
        try {
            const reqUrl = new URL(req.url || '/', `http://${req.headers.host}`);
            const obsParam = reqUrl.searchParams.get('obs');
            const path = reqUrl.pathname;

            if (path === "/" && obsParam) {
                clientSocket.onerror = err => {
                    console.error('⚠️ Erreur côté client :', err);
                };

                clientSocket.onclose = event => {
                    console.log(`🛑 WebSocket Client fermé : code ${event.code}, raison : "${event.reason}"`);
                    removeThisToObsWs(clientSocket);
                }

                const targetWsUrl = decodeURIComponent(obsParam);
                const credential = allWS.find(e => e.Pseudo === targetWsUrl);

                if (!credential) {
                    clientSocket.close(4009, "Authentication failed.");
                    return;
                }

                console.log('🔌 Client connecté');
                console.log('🌐 Connexion à l\'OBS cible:', targetWsUrl);

                const salt = randomBytes(16).toString('base64');
                const challenge = randomBytes(16).toString('base64');

                const secret = sha256base64(credential.Password + salt);
                const expectedAuth = sha256base64(secret + challenge);

                const jsonObsVersion = JSON.parse(credential.OBSVersion);

                clientSocket.once('message', (message) => {
                    try {
                        const data = JSON.parse(message.toString());

                        if (data?.d?.authentication) {
                            const clientAuth = data.d.authentication;

                            if (clientAuth === expectedAuth) {
                                console.log('🔓 Authentification réussie');

                                const credential = allWS.find(e => e.Pseudo === targetWsUrl);
                                if (!credential) throw new Error();
                                credential.wsDest.push(clientSocket);
                                clientSocket.onmessage = event => {
                                    console.log(event.data)
                                    const data = event.data;
                                    if (!credential?.ws) return;
                                    if (credential.ws.readyState !== WebSocket.OPEN) return;
                                    credential.ws.send(data)
                                }

                                clientSocket.send(credential.OBSVersion);
                            } else {
                                console.log('🔒 Authentification échouée');
                                clientSocket.close(4009, "Authentication failed.");
                            }
                        }
                    } catch (err) {
                        console.error('Erreur de parsing ou d\'authentification :', err);
                    }
                });

                clientSocket.send(JSON.stringify({
                    op: 0,
                    d: {
                        authentication: {
                            salt,
                            challenge
                        },
                        obsWebSocketVersion: jsonObsVersion.d.obsWebSocketVersion,
                        rpcVersion: jsonObsVersion.d.rpcVersion
                    }
                }));
            }
            else if (path === "/client") {
                console.log('🔌 OBS connecté');

                clientSocket.onmessage = event => {
                    const data = event.data.toString();
                    const json = JSON.parse(data);
                    if (json.w !== undefined) {
                        if (!json.w.Pseudo || !json.w.Password || !json.w.OBSVersion || typeof json.w.Pseudo !== 'string' || typeof json.w.Password !== 'string' || typeof json.w.OBSVersion !== 'string' || json.w.Password.length < 8 || json.w.Pseudo === "" || json.w.Pseudo === "Admin") {
                            clientSocket.close(4009, "Incomplete credential.");
                            return;
                        }
                        if (allWS.find(e => e.Pseudo === json.w.Pseudo && e.ws !== clientSocket)) {
                            clientSocket.close(4009, "This user is already taken.");
                            return;
                        }

                        removeThisObsWs(clientSocket);

                        allWS.push({
                            Pseudo: json.w.Pseudo,
                            Password: json.w.Password,
                            OBSVersion: json.w.OBSVersion,
                            ws: clientSocket,
                            wsDest: []
                        })
                        console.log('🌐 Connexion de l\'OBS:', json.w.Pseudo);

                        return;
                    }
                    const credential = allWS.find(e => e.ws === clientSocket);
                    if (!credential) {
                        clientSocket.close(3000, "You cannot send websocket before confirmation of your credential.");
                        return;
                    }
                    for (let i = 0; i < credential.wsDest.length; i++) {
                        const wsDest = credential.wsDest[i];
                        if (wsDest.readyState !== WebSocket.OPEN) return;
                        wsDest.send(data);
                    }
                }
                
                clientSocket.onerror = err => {
                    console.error('⚠️ Erreur côté client :', err);
                };

                clientSocket.onclose = event => {
                    console.log(`🛑 WebSocket OBS fermé : code ${event.code}, raison : "${event.reason}"`);
                    removeThisObsWs(clientSocket);
                }
            }
            else {
                console.error('❌ URL de connection invalide');
                clientSocket.close(1008, 'URL de connection invalide');
            }
        } catch (err) {
            console.error('❌ Erreur lors du traitement de la connexion :', err);
            clientSocket.close(1011, 'Erreur serveur');
        }
    });
}

export default initWs;