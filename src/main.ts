/// <reference types="@songloft/plugin-sdk" />
import { jsonResponse, createRouter, HTTPRequest, HTTPResponse } from '@songloft/plugin-sdk';

const router = createRouter();

// 极简且精准的 Body 解析
function getReqBodyText(body: any): string {
    if (!body) return "";
    // 已经探明底层直接传递了字符串
    if (typeof body === 'string') return body;
    try {
        return new TextDecoder().decode(body);
    } catch (e) {
        return "";
    }
}

router.post('/upload', async (req) => {
    try {
        const bodyText = getReqBodyText(req.body);
        if (!bodyText) return jsonResponse({ error: '请求体为空' }, 400);

        const data = JSON.parse(bodyText);
        const base64Str = data.audio_base64;

        if (!base64Str) return jsonResponse({ error: '未找到 audio_base64 字段' }, 400);

        // 1. 用 SDK 原生能力解码 Base64 并落盘
        await songloft.fs.writeFile('voice_raw.webm', base64Str, { encoding: 'base64' });

        // 2. 拉起 ffmpeg 压制为 MP3
        await songloft.command.exec('ffmpeg', [
            '-y',
            '-i', 'voice_raw.webm',
            '-c:a', 'libmp3lame',
            '-b:a', '128k',
            'static/voice.mp3'
        ]);

        // 3. 返回真实 MP3 直链给前端
        const hostUrl = await songloft.plugin.getHostUrl();
        return jsonResponse({
            success: true,
            url: `${hostUrl}/api/v1/jsplugin/remote-caller/files/voice.mp3`
        });
    } catch (e: any) {
        songloft.log.error("转码处理失败: " + e.toString());
        return jsonResponse({ success: false, error: e.toString() }, 500);
    }
});

function onInit(): void { songloft.log.info('remote-caller initialized'); }
function onDeinit(): void { songloft.log.info('remote-caller deinitialized'); }
function onHTTPRequest(req: HTTPRequest): HTTPResponse | Promise<HTTPResponse> { return router.handle(req); }

// @ts-expect-error
globalThis.onInit = onInit;
// @ts-expect-error
globalThis.onDeinit = onDeinit;
// @ts-expect-error
globalThis.onHTTPRequest = onHTTPRequest;