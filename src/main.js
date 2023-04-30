import {Telegraf, session} from 'telegraf'
import {message} from 'telegraf/filters'
import {code} from 'telegraf/format'
import config from "config"
import {ogg} from "./ogg.js"
import {openai} from "./openai.js"

console.log(config.get('ENV'))

const INITIAL_SESSION = {
    messages: []
}

const bot = new Telegraf(config.get('TELEGRAM_TOKEN'))

bot.use(session())

bot.command('new', async (ctx) => {
    ctx.session = INITIAL_SESSION
    await ctx.reply('Жду вашего голосового или текстового сообщения')
})

bot.command('start', async (ctx) => {
    ctx.session = INITIAL_SESSION
    await ctx.reply('Жду вашего голосового или текстового сообщения')
})

bot.on(message('text'), async (ctx) => {
    ctx.session ??= INITIAL_SESSION
    try {
        await ctx.reply(code('Обработка вашего сообщения...'))

        ctx.session.messages.push({role: openai.roles.USER, content: ctx.message.text})

        await ctx.reply(code(`Ваш запрос: ${ctx.message.text}.\nЖду ответа GPT ...`))

        const response = await openai.chat(ctx.session.messages)
        ctx.session.messages.push({role: openai.roles.ASSISTANT, content: response.content})

        response.content
            .split('```')
            .map(async (text, i) => await ctx.reply(text.trim()))

    } catch (e) {
        console.log(`Error while voice message`, e.message)
    }
})

bot.on(message('voice'), async (ctx) => {
    ctx.session ??= INITIAL_SESSION
    try {
        await ctx.reply(code('Обработка вашего голосового сообщения...'))

        const link = await ctx.telegram.getFileLink(ctx.message.voice.file_id);
        const userId = String(ctx.message.from.id)
        const oggPath = await ogg.create(link.href, userId)
        const mp3Path = await ogg.toMp3(oggPath, userId)

        const text = await openai.transcription(mp3Path)
        ctx.session.messages.push({role: openai.roles.USER, content: text})

        await ctx.reply(code(`Ваш запрос: ${text}.\nЖду ответа GPT ...`))

        const response = await openai.chat(ctx.session.messages)
        ctx.session.messages.push({role: openai.roles.ASSISTANT, content: response.content})

        response.content
            .split('```')
            .map(async (text, i) => await ctx.reply(text.trim()))

    } catch (e) {
        console.log(`Error while voice message`, e.message)
    }
})

bot.launch()

process.once('SIGINT', () => bot.stop('SIGINT'))
process.once('SIGTERM', () => bot.stop('SIGTERM'))
