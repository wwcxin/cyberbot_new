import { type Plugin, ctx, napcat, logger, Structs } from "../../core/index.js";
import OpenAI from 'openai';
import puppeteer from 'puppeteer'

const config = {
    openai:{
        apiKey: process.env.MODELSCOPE_API_KEY, // 'sk-' 此处是模型平台的apikey
        baseURL: 'https://api.bltcy.ai/v1/',
        models: 'gpt-5-mini'
    },
    BOT: {
        triggerWord: ".gpt",
        blockedGroups: [123456789, 87654321],
        systemPrompt: "请你扮演一个在 QQ 群里进行互动的全能问答机器人，你拥有海量的知识储备，可以极其熟练、正确的回答各种问题，你的回答生动而形象，回复内容中恰到好处地插入许多 emoji，得体而不胡哨，请你以 GitHub Flavored Markdown 格式回复，必要时可以使用高级语法，如 GitHub styled Alert 语法（比如 `> [!NOTE]  \nThis is tip.` 还有 TIP、IMPORTANT、WARNING、CAUTION 类型）、表格、Katex 数学公式等等，你尽可能的使用其强大的语法和生动形象的语言来呈现你的回答，每次回答都不少于 100 个字符，除非群友特殊说明，请尽可能使用中文回复。为了更加真实的扮演真实群友，请你不要介意'机器人回复不够礼貌'的问题，你可以在情节合适且必要时附带些嘲讽、挖苦、看热闹不嫌事大的语气。接下来请你回复或解答以下群友的问题，请直接回复下列内容："
    },
    RENDER: {
        markdownApi: 'http://101.132.20.237:3000',
        width: 900,
        initialHeight: 0,
        timeout: 30000
    },
    CACHE: {
        imageCacheSize: 100,
        cacheTTL: 3600000
    }
}

const client = new OpenAI({
    apiKey: config.openai.apiKey,
    baseURL: config.openai.baseURL
  });

const plugin: Plugin = {
  name: 'chatgpt',  // name必须与此插件文件夹命名一致, 不然可能会出问题
  version: '1.0.0',
  description: 'chatgpt',
  handlers: {
    message: async (e) => {
        if (!ctx.getText(e).startsWith(config.BOT.triggerWord)) return;
        const quotedText = await ctx.getQuotedText(e)
        if (ctx.getText(e).replace(config.BOT.triggerWord, '').trim() == '' && quotedText == '') return;
        const prompt = quotedText || ctx.getText(e).replace(config.BOT.triggerWord, '').trim();
        const response = await client.chat.completions.create({
            model: config.openai.models,
            messages: [
                { role: 'system', content: config.BOT.systemPrompt },
                { role: 'user', content: prompt }
            ]
        });
        // const html = await mdToHtml(response.choices[0].message.content!);
        if (!response.choices[0].message.content) {
            await ctx.reply(e, 'AI 返回内容为空');
            return;
        }
        const html = await mdToHtml(response.choices[0].message.content);
        const base64Image = await htmlToBase64(html);
        await ctx.reply(e, [Structs.image(base64Image)]);
    },
  },
};

/**
 * 将 Markdown 转换为 HTML
 * @param md - Markdown 文本
 * @returns Promise<string> HTML 文本
 */
async function mdToHtml(md: string): Promise<string> {
    const html = await fetch(config.RENDER.markdownApi, {
        method: 'POST',
        body: md,
    });
    return html.text();
}



// 加载浏览器
const browser = await puppeteer.launch();

/**
 * 将 HTML 转换为 Base64 图片
 * @param htmlContent - HTML 内容
 * @returns Promise<string> Base64 图片
 */
async function htmlToBase64(htmlContent: string): Promise<string> {
    const page = await browser.newPage();
    await page.setViewport({ width: config.RENDER.width, height: config.RENDER.initialHeight });
    await page.setContent(htmlContent);
    await new Promise(resolve => setTimeout(resolve, config.RENDER.timeout));  // 等待3秒钟以确保渲染完成
    const screenshotBuffer = await page.screenshot({ fullPage: true });
    const base64Image = Buffer.from(screenshotBuffer).toString('base64');
    // await browser.close();
    return `base64://${base64Image}`;
  }

export default plugin;