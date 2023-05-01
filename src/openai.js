import {Configuration, OpenAIApi} from "openai"
import {createReadStream} from 'fs'
import {removeFile} from "./utils.js"

class OpenAI {
    roles = {
        ASSISTANT: 'assistant',
        USER: 'user',
        SYSTEM: 'system'
    }

    constructor(apiKey) {
        const configuration = new Configuration({apiKey})
        this.openai = new OpenAIApi(configuration)
    }

    async chat(messages) {
        try {
            const response = await this.openai.createChatCompletion({
                model: 'gpt-3.5-turbo',
                messages,
            })
            return response.data.choices[0].message
        } catch (e) {
            console.log('Error while chat with gpt', e.message)
        }
    }

    async transcription(filepath) {
        try {
            const response = await this.openai.createTranscription(
                createReadStream(filepath),
                'whisper-1'
            )
            removeFile(filepath)
            return response.data.text
        } catch (e) {
            console.log('Error while transcription process', e.message)
        }
    }
}

export const openai = new OpenAI(process.env.OPENAI_API_KEY)
