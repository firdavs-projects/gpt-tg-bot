import config from "config"
import {Telegraf, session} from 'telegraf'
import {message} from 'telegraf/filters'
import {code} from 'telegraf/format'
import {ogg} from "./ogg.js"
import {openai} from "./openai.js"

console.log(config.get('ENV'))

const INITIAL_SESSION = {
    messages: []
}

const bot = new Telegraf(config.get('TELEGRAM_TOKEN'))

bot.use(session())

bot.use(async (ctx, next) => {
    const botName = `@${ctx.botInfo.username}`
    if (
        ctx.message &&
        (ctx.message.chat.type === 'group' || ctx.message.chat.type === 'supergroup') &&
        ctx.message.text.includes(botName)
    ) {
        ctx.session ??= INITIAL_SESSION
        const text = ctx.message.text
            .replace(botName, '').trim()

        ctx.session.messages.push({
            role: openai.roles.USER,
            content: text || "Представься Акмаль в неформальном стиле и продолжи разговор тоже в неформальном стиле бро"
        })

        await ctx.reply(code(`Обработка сообщения ${ctx?.message.from.first_name} ...`))

        const response = await openai.chat(ctx.session.messages)
        ctx.session.messages.push({role: openai.roles.ASSISTANT, content: response.content})

        response?.content
            ? response?.content
                .split('```')
                .map(async (text) => await ctx.reply(text.trim()))
            : await ctx.reply('Ошибка сервера')

    }
    return next()
})

// bot.use(Telegraf.log());

bot.help((ctx) => ctx.reply(`
/new - Обновить сессию
/start - Запуск бота
/help - Помощь
`))

bot.command('new', async (ctx) => {
    await ctx.reply('В процессе создания новой сессии ...')
    ctx.session = INITIAL_SESSION
    ctx.session.messages.push({
        role: openai.roles.USER,
        content: "Создана новая сессия. Ты теперь Акмаль. Разговаривай и представься в неформальном стиле и напомни что у нас новая сессия в неформальном стиле бро"
    })
    const response = await openai.chat(ctx.session.messages)
    ctx.session.messages.push({role: openai.roles.ASSISTANT, content: response.content})
    await ctx.reply(response?.content ?? 'Создана новая сессия. Жду вашего голосового или текстового сообщения')
})

bot.command('start', async (ctx) => {
    await ctx.reply('Инициализация ...')
    ctx.session = INITIAL_SESSION
    ctx.session.messages.push({
        role: openai.roles.USER,
        content: "Ты теперь Акмаль. Представься с новым именем в неформальном стиле и продолжи разговор тоже в неформальном стиле бро"
    })
    const response = await openai.chat(ctx.session.messages)
    console.log(response)
    ctx.session.messages.push({role: openai.roles.ASSISTANT, content: response?.content})
    await ctx.reply(response?.content || JSON.stringify(response) || 'Привет Я Акмаль. Жду вашего голосового или текстового сообщения')
})

bot.on(message('text'), async (ctx) => {
    ctx.session ??= INITIAL_SESSION
    if (ctx.message.chat.type === 'private') {
        try {
            await ctx.reply(code(`Обработка сообщения ${ctx?.message.from.first_name} ...`))
            ctx.session.messages.push({role: openai.roles.USER, content: ctx.message.text})

            // await ctx.reply(code(`Ваше сообщение: ${ctx.message.text}\nОбработка ...`))

            const response = await openai.chat(ctx.session.messages)
            ctx.session.messages.push({role: openai.roles.ASSISTANT, content: response.content})

            response?.content
                ? response?.content
                    .split('```')
                    .map(async (text) => await ctx.reply(text.trim()))
                : await ctx.reply('Ошибка сервера')

        } catch (e) {
            console.log(`Error while voice message`, e.message)
        }
    }
})

bot.on(message('voice'), async (ctx) => {
    ctx.session ??= INITIAL_SESSION
    if (ctx.message.chat.type === 'private') {
        try {
            await ctx.reply(code(`Обработка голосового сообщения от ${ctx?.message.from.first_name} ...`))

            const link = await ctx.telegram.getFileLink(ctx.message.voice.file_id);
            const userId = String(ctx.message.from.id)
            const oggPath = await ogg.create(link.href, userId)
            const mp3Path = await ogg.toMp3(oggPath, userId)

            const text = await openai.transcription(mp3Path)
            ctx.session.messages.push({role: openai.roles.USER, content: text})

            await ctx.reply(code(`Сообщение: ${text} ...`))

            const response = await openai.chat(ctx.session.messages)
            ctx.session.messages.push({role: openai.roles.ASSISTANT, content: response.content})

            response?.content ?
                response?.content
                    .split('```')
                    .map(async (text) => await ctx.reply(text.trim()))
                : await ctx.reply('Ошибка сервера')

        } catch (e) {
            console.log(`Error while voice message`, e.message)
        }
    }
})

bot.launch()

process.once('SIGINT', () => bot.stop('SIGINT'))
process.once('SIGTERM', () => bot.stop('SIGTERM'))
