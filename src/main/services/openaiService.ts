import OpenAI from 'openai'
import type { ChatCompletionMessageParam } from 'openai/resources/chat/completions'

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system'
  content: string
}

export interface StreamChunk {
  delta: string
  done: boolean
}

const SYSTEM_PROMPT = `You are an intelligent job application assistant. Your main capabilities:

1. **Company Research**: Find programming/tech companies in specific countries or cities (especially Austria), and compile detailed lists with names, websites, email contacts, and descriptions.

2. **Email Drafting**: Write professional job application emails in German or English. When writing in German, use formal language (Sie-Form). Always include:
   - Professional greeting
   - Brief introduction
   - Why you're interested in the company
   - Your key skills and experience
   - Request for interview/consideration
   - Professional closing

3. **Job Application Management**: Help organize and track applications, suggest follow-up strategies.

4. **Email Analysis**: Analyze received emails and suggest appropriate responses.

When asked to find companies, always provide:
- Company name
- Industry/specialization
- Website
- Email contact (if publicly available, or suggest contact form)
- Brief description
- Location in Austria

Format company lists as structured JSON when the user will use them for sending applications.

Always be professional, accurate, and helpful. Communicate in the same language the user uses.`

export async function streamChat(
  apiKey: string,
  messages: ChatMessage[],
  onChunk: (chunk: StreamChunk) => void
): Promise<void> {
  const client = new OpenAI({ apiKey })

  const formattedMessages: ChatCompletionMessageParam[] = [
    { role: 'system', content: SYSTEM_PROMPT },
    ...messages.map((m) => ({ role: m.role, content: m.content } as ChatCompletionMessageParam))
  ]

  const stream = await client.chat.completions.create({
    model: 'gpt-4o',
    messages: formattedMessages,
    stream: true,
    temperature: 0.7,
    max_tokens: 4096
  })

  for await (const chunk of stream) {
    const delta = chunk.choices[0]?.delta?.content || ''
    const done = chunk.choices[0]?.finish_reason === 'stop'
    onChunk({ delta, done })
  }
}

export async function generateJobEmail(
  apiKey: string,
  params: {
    companyName: string
    jobTitle?: string
    language: 'de' | 'en'
    senderName: string
    senderSkills: string
    cvPath?: string
  }
): Promise<string> {
  const client = new OpenAI({ apiKey })

  const prompt =
    params.language === 'de'
      ? `Schreibe eine professionelle Bewerbungs-E-Mail auf Deutsch (Sie-Form) an die Firma "${params.companyName}".
Bewerber: ${params.senderName}
Skills: ${params.senderSkills}
${params.jobTitle ? `Angestrebte Position: ${params.jobTitle}` : 'Initiativbewerbung als Programmierer/Softwareentwickler'}
${params.cvPath ? 'Lebenslauf ist beigefügt.' : ''}

Schreibe eine vollständige E-Mail mit Betreff und Inhalt. Formatierung: HTML.`
      : `Write a professional job application email in English to company "${params.companyName}".
Applicant: ${params.senderName}
Skills: ${params.senderSkills}
${params.jobTitle ? `Target position: ${params.jobTitle}` : 'Spontaneous application as a programmer/software developer'}
${params.cvPath ? 'CV is attached.' : ''}

Write a complete email with subject line and body. Format: HTML.`

  const response = await client.chat.completions.create({
    model: 'gpt-4o',
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: prompt }
    ],
    temperature: 0.6
  })

  return response.choices[0]?.message?.content || ''
}
