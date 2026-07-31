// ============================================================================
//   VLESS Serverless Worker v6.0 (No VPS Required) + Web Dashboard
//   Работает на базе cloudflare:sockets. Поддержка VLESS + Websocket.
// ============================================================================

import { connect } from 'cloudflare:sockets';

// ----------------------------------------------------------------------------
// 1. НАСТРОЙКИ (Ваши персональные данные)
// ----------------------------------------------------------------------------
// Сгенерируйте свой UUID (например, на сайте uuidgenerator.net)
const UUID = 'd342d11e-d424-4583-b36e-524ab1f0afa4';

// Пути, по которым будет работать наш VLESS WebSocket
// Чем больше путей, тем больше профилей мы сгенерируем в подписке
const WS_PATHS = ['/vless', '/tg', '/youtube', '/cloudflare'];

// SNI (Server Name Indication) — домены для маскировки (Bug SNI)
// Эти домены будут использоваться для создания разных профилей в подписке
const SNI_LIST = [
    'www.digitalocean.com',
    'speed.cloudflare.com',
    'www.visa.com',
    'www.udemy.com'
];


// ----------------------------------------------------------------------------
// 2. ОСНОВНОЙ РОУТЕР
// ----------------------------------------------------------------------------
export default {
    async fetch(request, env, ctx) {
        try {
            const url = new URL(request.url);
            const path = url.pathname;
            const hostname = url.hostname;

            // Если это запрос на WebSocket - передаем в обработчик VLESS
            const upgradeHeader = request.headers.get('Upgrade');
            if (upgradeHeader && upgradeHeader.toLowerCase() === 'websocket') {
                return await vlessOverWSHandler(request);
            }

            // Обработка маршрута подписки
            if (path === '/sub') {
                return generateSubscription(hostname);
            }

            // Главная страница - красивая панель управления
            if (path === '/') {
                return renderDashboard(hostname);
            }

            // Если путь не найден и это не WebSocket
            return new Response('404 Not Found', { status: 404 });

        } catch (err) {
            console.error('Global Error:', err);
            return new Response('Internal Server Error', { status: 500 });
        }
    }
};

// ----------------------------------------------------------------------------
// 3. ГЕНЕРАТОР ПОДПИСКИ (Base64)
// ----------------------------------------------------------------------------
function generateSubscription(hostname) {
    let subLinks = [];

    // Генерируем конфигурации для каждого пути и каждого SNI
    for (const sni of SNI_LIST) {
        for (const path of WS_PATHS) {
            const name = encodeURIComponent(`CF-Node [${sni.split('.')[1]}] ${path}`);
            // Формируем VLESS ссылку
            const link = `vless://${UUID}@${hostname}:443?encryption=none&security=tls&sni=${sni}&type=ws&host=${hostname}&path=${encodeURIComponent(path)}#${name}`;
            subLinks.push(link);
        }
    }

    // Подписки обычно передаются в Base64 для клиентов вроде Hiddify / v2rayN
    const base64Sub = btoa(subLinks.join('\n'));

    return new Response(base64Sub, {
        headers: {
            'Content-Type': 'text/plain; charset=utf-8',
            'Cache-Control': 'no-store',
            'Access-Control-Allow-Origin': '*'
        }
    });
}

// ----------------------------------------------------------------------------
// 4. HTML ИНТЕРФЕЙС (Панель управления)
// ----------------------------------------------------------------------------
function renderDashboard(hostname) {
    const subUrl = `https://${hostname}/sub`;
    const singleLink = `vless://${UUID}@${hostname}:443?encryption=none&security=tls&sni=speed.cloudflare.com&type=ws&host=${hostname}&path=%2Fvless#CF-VLESS-Main`;

    const html = `
    <!DOCTYPE html>
    <html lang="ru" class="dark">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>VLESS Serverless Dashboard</title>
        <script src="https://cdn.tailwindcss.com"></script>
        <script>
            tailwind.config = {
                darkMode: 'class',
                theme: { extend: { colors: { cf: '#F38020' } } }
            }
            function copyText(id) {
                const text = document.getElementById(id).innerText;
                navigator.clipboard.writeText(text).then(() => {
                    const btn = document.getElementById('btn-' + id);
                    const origText = btn.innerText;
                    btn.innerText = 'Скопировано!';
                    btn.classList.add('bg-green-600');
                    setTimeout(() => {
                        btn.innerText = origText;
                        btn.classList.remove('bg-green-600');
                    }, 2000);
                });
            }
        </script>
        <style>
            body { background-color: #111827; color: #f3f4f6; }
        </style>
    </head>
    <body class="antialiased min-h-screen flex flex-col items-center justify-center p-4">
        
        <div class="max-w-3xl w-full bg-gray-800 rounded-2xl shadow-2xl overflow-hidden border border-gray-700">
            <div class="bg-gray-900 px-6 py-8 border-b border-gray-700 text-center">
                <h1 class="text-3xl font-bold text-white mb-2">🚀 V-Bridge Serverless</h1>
                <p class="text-gray-400">Ваш личный VLESS прокси на базе Cloudflare Workers (без VPS)</p>
            </div>
            
            <div class="p-6 space-y-8">
                
                <!-- Подписка -->
                <div class="bg-gray-750 p-5 rounded-xl border border-gray-600">
                    <h2 class="text-xl font-semibold mb-3 flex items-center text-cf">
                        <svg class="w-6 h-6 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"></path></svg>
                        Ссылка на подписку (Для Hiddify / Happ / v2rayN)
                    </h2>
                    <p class="text-sm text-gray-400 mb-4">Скопируйте эту ссылку и вставьте в ваш клиент. В ней содержатся сразу несколько серверов с разными путями и доменами для маскировки.</p>
                    <div class="flex items-center gap-2">
                        <code id="sub-link" class="flex-1 bg-gray-900 p-3 rounded-lg overflow-x-auto whitespace-nowrap text-sm text-green-400 border border-gray-700">${subUrl}</code>
                        <button id="btn-sub-link" onclick="copyText('sub-link')" class="bg-cf hover:bg-orange-600 text-white px-4 py-3 rounded-lg font-medium transition-colors whitespace-nowrap">Скопировать</button>
                    </div>
                </div>

                <!-- Быстрый сервер -->
                <div class="bg-gray-750 p-5 rounded-xl border border-gray-600">
                    <h2 class="text-xl font-semibold mb-3 text-blue-400">Одиночный сервер (VLESS URL)</h2>
                    <p class="text-sm text-gray-400 mb-4">Если вам нужен только один конфиг, а не вся подписка.</p>
                    <div class="flex items-center gap-2">
                        <code id="single-link" class="flex-1 bg-gray-900 p-3 rounded-lg overflow-x-auto whitespace-nowrap text-sm text-blue-300 border border-gray-700">${singleLink}</code>
                        <button id="btn-single-link" onclick="copyText('single-link')" class="bg-blue-600 hover:bg-blue-500 text-white px-4 py-3 rounded-lg font-medium transition-colors whitespace-nowrap">Скопировать</button>
                    </div>
                </div>

                <!-- Данные сервера -->
                <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div class="bg-gray-900 p-4 rounded-lg border border-gray-700">
                        <div class="text-xs text-gray-500 uppercase tracking-wider mb-1">Ваш UUID</div>
                        <div class="font-mono text-sm text-gray-300 break-all">${UUID}</div>
                    </div>
                    <div class="bg-gray-900 p-4 rounded-lg border border-gray-700">
                        <div class="text-xs text-gray-500 uppercase tracking-wider mb-1">Домен Воркера</div>
                        <div class="font-mono text-sm text-gray-300">${hostname}</div>
                    </div>
                </div>
            </div>
            
            <div class="bg-gray-900 px-6 py-4 border-t border-gray-700 text-center text-sm text-gray-500">
                Запущено на Cloudflare V8 Isolates • <a href="https://github.com/zizifn/edgetunnel" target="_blank" class="hover:text-white transition">Based on EdgeTunnel Logic</a>
            </div>
        </div>
    </body>
    </html>
    `;

    return new Response(html, {
        headers: { 'Content-Type': 'text/html; charset=utf-8' }
    });
}

// ----------------------------------------------------------------------------
// 5. ОБРАБОТЧИК VLESS (Разбор протокола и TCP сокеты)
// ----------------------------------------------------------------------------
async function vlessOverWSHandler(request) {
    const webSocketPair = new WebSocketPair();
    const [client, webSocket] = Object.values(webSocketPair);

    webSocket.accept();

    let address = '';
    let portWithRandomLog = '';
    let log = (info, event) => {
        console.log(`[${address}:${portWithRandomLog}] ${info}`, event || '');
    };
    let earlyDataHeader = request.headers.get('sec-websocket-protocol') || '';

    const readableWebSocketStream = makeReadableWebSocketStream(webSocket, earlyDataHeader, log);
    
    // Переменная для хранения удаленного TCP сокета
    let remoteSocketWrapper = {
        value: null,
    };
    
    let isDns = false; // Для UDP/DNS запросов (обычно отбрасываются в базовой версии)

    // Парсим VLESS поток
    readableWebSocketStream.pipeTo(new WritableStream({
        async write(chunk, controller) {
            // Если сокет уже подключен - просто пересылаем данные
            if (remoteSocketWrapper.value) {
                const writer = remoteSocketWrapper.value.writable.getWriter();
                await writer.write(chunk);
                writer.releaseLock();
                return;
            }

            // Иначе - это ПЕРВЫЙ пакет. В нем содержится VLESS Header.
            try {
                const {
                    hasError,
                    message,
                    portRemote,
                    addressRemote,
                    rawDataIndex,
                    vlessVersion,
                    isUDP,
                } = processVlessHeader(chunk, UUID);

                address = addressRemote;
                portWithRandomLog = `${portRemote}-${Math.random().toString(36).substring(2, 6)}`;
                
                if (hasError) {
                    throw new Error(message);
                }

                if (isUDP) {
                    isDns = portRemote === 53;
                    // В Cloudflare Workers прямая поддержка UDP ограничена.
                    // Для DNS нужно использовать DoH, для остального UDP обычно игнорируется.
                    // В этой версии мы фокусируемся на TCP, что достаточно для 95% сайтов.
                }

                // ----------------------------------------------------------------
                // МАГИЯ: Устанавливаем прямое TCP-соединение к целевому серверу!
                // ----------------------------------------------------------------
                const tcpSocket = connect({
                    hostname: addressRemote,
                    port: portRemote
                });
                remoteSocketWrapper.value = tcpSocket;

                log(`Connected to ${addressRemote}:${portRemote}`);

                const writer = remoteSocketWrapper.value.writable.getWriter();
                
                // В ответ на WebSocket мы обязаны отправить заголовок подтверждения VLESS
                // Версия VLESS (обычно 0) + 1 байт длины аддона (0)
                const vlessResponseHeader = new Uint8Array([vlessVersion[0], 0]);
                webSocket.send(vlessResponseHeader);

                // Если в первом пакете после заголовка были полезные данные - отправляем их в TCP
                const rawClientData = chunk.slice(rawDataIndex);
                if (rawClientData.byteLength > 0) {
                    await writer.write(rawClientData);
                }
                writer.releaseLock();

                // Теперь берем данные из TCP сокета и отправляем их обратно в WebSocket
                remoteSocketWrapper.value.readable.pipeTo(new WritableStream({
                    async write(tcpChunk) {
                        if (webSocket.readyState === WS_READY_STATE_OPEN) {
                            webSocket.send(tcpChunk);
                        }
                    },
                    close() {
                        log(`TCP connection closed by remote`);
                    },
                    abort(reason) {
                        console.error('TCP stream aborted', reason);
                    }
                })).catch(err => {
                    console.error('Error piping TCP to WS', err);
                });

            } catch (error) {
                log('VLESS processing error', error.message);
                webSocket.close();
            }
        },
        close() {
            log('WebSocket closed by client');
            if (remoteSocketWrapper.value) {
                remoteSocketWrapper.value.close();
            }
        },
        abort(err) {
            log('WebSocket stream aborted', err);
            if (remoteSocketWrapper.value) {
                remoteSocketWrapper.value.close();
            }
        }
    })).catch((err) => {
        log('Error in WebSocket pipe', err);
    });

    return new Response(null, {
        status: 101,
        webSocket: client,
    });
}

// ----------------------------------------------------------------------------
// 6. ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ VLESS ПАРСЕРА
// ----------------------------------------------------------------------------

const WS_READY_STATE_OPEN = 1;

// Превращает события WebSocket в ReadableStream
function makeReadableWebSocketStream(webSocketServer, earlyDataHeader, log) {
    let readableStreamCancel = false;
    const stream = new ReadableStream({
        start(controller) {
            webSocketServer.addEventListener('message', (event) => {
                if (readableStreamCancel) return;
                const message = event.data;
                controller.enqueue(message);
            });
            webSocketServer.addEventListener('close', () => {
                if (!readableStreamCancel) {
                    controller.close();
                }
            });
            webSocketServer.addEventListener('error', (err) => {
                log('WebSocket server has error', err);
                if (!readableStreamCancel) controller.error(err);
            });
            // Обработка данных, переданных в заголовках (Early Data, для Xray)
            if (earlyDataHeader) {
                try {
                    const earlyData = earlyDataHeader.replace(/-/g, '+').replace(/_/g, '/');
                    const decoded = atob(earlyData);
                    const buf = new Uint8Array(decoded.length);
                    for (let i = 0; i < decoded.length; i++) {
                        buf[i] = decoded.charCodeAt(i);
                    }
                    controller.enqueue(buf.buffer);
                } catch (e) {
                    log('Failed to parse early data', e);
                }
            }
        },
        cancel(reason) {
            readableStreamCancel = true;
            log('ReadableStream cancelled', reason);
            webSocketServer.close();
        }
    });
    return stream;
}

// Разбор заголовка VLESS запроса
// Структура: [version(1)] [UUID(16)] [addon_length(1)] [addon_data] [command(1)] [port(2)] [addr_type(1)] [addr]
function processVlessHeader(vlessBuffer, expectedUuid) {
    if (vlessBuffer.byteLength < 24) {
        return { hasError: true, message: 'Invalid VLESS data (too short)' };
    }

    const version = new Uint8Array(vlessBuffer.slice(0, 1));
    let isValidUser = false;
    
    // Читаем UUID (16 байт)
    const view = new DataView(vlessBuffer);
    const uuidBytes = new Uint8Array(vlessBuffer.slice(1, 17));
    const receivedUuid = stringifyUuid(uuidBytes);
    
    if (receivedUuid === expectedUuid) {
        isValidUser = true;
    }

    if (!isValidUser) {
        return { hasError: true, message: `Invalid UUID: ${receivedUuid}` };
    }

    const optLength = new Uint8Array(vlessBuffer.slice(17, 18))[0];
    let commandOffset = 18 + optLength;

    const command = new Uint8Array(vlessBuffer.slice(commandOffset, commandOffset + 1))[0];
    const isUDP = command === 2;

    commandOffset++;
    // Читаем порт (Big Endian)
    const portRemote = view.getUint16(commandOffset);
    commandOffset += 2;

    // Читаем адрес
    const addressType = new Uint8Array(vlessBuffer.slice(commandOffset, commandOffset + 1))[0];
    commandOffset++;

    let addressRemote = '';
    let addressLength = 0;

    if (addressType === 1) { // IPv4
        addressLength = 4;
        addressRemote = new Uint8Array(vlessBuffer.slice(commandOffset, commandOffset + addressLength)).join('.');
    } else if (addressType === 2) { // Domain Name
        addressLength = new Uint8Array(vlessBuffer.slice(commandOffset, commandOffset + 1))[0];
        commandOffset++;
        addressRemote = new TextDecoder().decode(vlessBuffer.slice(commandOffset, commandOffset + addressLength));
    } else if (addressType === 3) { // IPv6
        addressLength = 16;
        const ipv6Bytes = new Uint8Array(vlessBuffer.slice(commandOffset, commandOffset + addressLength));
        const ipv6 = [];
        for (let i = 0; i < 8; i++) {
            const hex = (ipv6Bytes[i * 2] << 8 | ipv6Bytes[i * 2 + 1]).toString(16);
            ipv6.push(hex);
        }
        addressRemote = ipv6.join(':');
    } else {
        return { hasError: true, message: `Unknown address type: ${addressType}` };
    }

    commandOffset += addressLength;

    return {
        hasError: false,
        addressRemote,
        portRemote,
        rawDataIndex: commandOffset,
        vlessVersion: version,
        isUDP
    };
}

// Утилита для конвертации байтов в строку UUID
function stringifyUuid(arr) {
    const byteToHex = [];
    for (let i = 0; i < 256; ++i) {
        byteToHex.push((i + 0x100).toString(16).substring(1));
    }
    return (byteToHex[arr[0]] + byteToHex[arr[1]] + byteToHex[arr[2]] + byteToHex[arr[3]] + "-" +
            byteToHex[arr[4]] + byteToHex[arr[5]] + "-" +
            byteToHex[arr[6]] + byteToHex[arr[7]] + "-" +
            byteToHex[arr[8]] + byteToHex[arr[9]] + "-" +
            byteToHex[arr[10]] + byteToHex[arr[11]] + byteToHex[arr[12]] +
            byteToHex[arr[13]] + byteToHex[arr[14]] + byteToHex[arr[15]]).toLowerCase();
}