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

export interface ModelConfig {
  provider: 'openai' | 'gemini' | 'groq'
  model: string
  apiKey: string
}

// All available models — free ones first
export const AVAILABLE_MODELS = [
  // FREE TIER
  {
    id: 'gemini-2.0-flash',
    name: 'Gemini 2.0 Flash',
    provider: 'gemini' as const,
    tier: 'free',
    description: 'Google · Fast & free'
  },
  {
    id: 'gemini-1.5-flash',
    name: 'Gemini 1.5 Flash',
    provider: 'gemini' as const,
    tier: 'free',
    description: 'Google · Free tier'
  },
  {
    id: 'llama-3.3-70b-versatile',
    name: 'Llama 3.3 70B',
    provider: 'groq' as const,
    tier: 'free',
    description: 'Groq · Fast & free'
  },
  {
    id: 'llama-3.1-8b-instant',
    name: 'Llama 3.1 8B',
    provider: 'groq' as const,
    tier: 'free',
    description: 'Groq · Fastest & free'
  },
  // PAID
  {
    id: 'gpt-4o-mini',
    name: 'GPT-4o Mini',
    provider: 'openai' as const,
    tier: 'paid',
    description: 'OpenAI · Cheap & smart'
  },
  {
    id: 'gpt-4o',
    name: 'GPT-4o',
    provider: 'openai' as const,
    tier: 'paid',
    description: 'OpenAI · Best quality'
  },
  {
    id: 'gpt-3.5-turbo',
    name: 'GPT-3.5 Turbo',
    provider: 'openai' as const,
    tier: 'paid',
    description: 'OpenAI · Low cost'
  }
]

function buildClient(config: ModelConfig): OpenAI {
  if (config.provider === 'gemini') {
    return new OpenAI({
      apiKey: config.apiKey,
      baseURL: 'https://generativelanguage.googleapis.com/v1beta/openai/'
    })
  }
  if (config.provider === 'groq') {
    return new OpenAI({
      apiKey: config.apiKey,
      baseURL: 'https://api.groq.com/openai/v1'
    })
  }
  return new OpenAI({ apiKey: config.apiKey })
}

const SYSTEM_PROMPT = `You are an intelligent job application assistant. Your main capabilities:

1. **Company Research**: Find programming/tech companies in specific countries or cities (especially Austria), and compile lists with names, websites, email contacts, and descriptions.

2. **Email Drafting**: Write professional job application emails in German (Sie-Form) or English. Include greeting, introduction, why the company, skills, and professional closing.

3. **Bulk Email Planning**: When asked to apply/send to multiple companies, ALWAYS output a structured plan as a fenced JSON block BEFORE sending anything. The block must be tagged exactly like this:

\`\`\`bulk_email_plan
[
  {
    "company": "Company Name GmbH",
    "to": "jobs@company.at",
    "subject": "Bewerbung als Softwareentwickler",
    "body": "<p>Sehr geehrte Damen und Herren...</p>"
  }
]
\`\`\`

After the block, add a short summary like: "I prepared N emails. Please review the list and approve to send."

4. **IMPORTANT**: Never claim to have sent emails directly. Always output the bulk_email_plan block first for user approval.

When finding companies, provide: name, industry, website, email (if public), city in Austria.
Communicate in the same language the user uses.`

export async function streamChat(
  config: ModelConfig,
  messages: ChatMessage[],
  onChunk: (chunk: StreamChunk) => void
): Promise<void> {
  const client = buildClient(config)

  const formattedMessages: ChatCompletionMessageParam[] = [
    { role: 'system', content: SYSTEM_PROMPT },
    ...messages.map((m) => ({ role: m.role, content: m.content } as ChatCompletionMessageParam))
  ]

  const stream = await client.chat.completions.create({
    model: config.model,
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
  config: ModelConfig,
  params: {
    companyName: string
    jobTitle?: string
    language: 'de' | 'en'
    senderName: string
    senderSkills: string
    cvPath?: string
  }
): Promise<string> {
  const client = buildClient(config)

  const prompt =
    params.language === 'de'
      ? `Schreibe eine professionelle Bewerbungs-E-Mail auf Deutsch (Sie-Form) an die Firma "${params.companyName}".
Bewerber: ${params.senderName}
Skills: ${params.senderSkills}
${params.jobTitle ? `Angestrebte Position: ${params.jobTitle}` : 'Initiativbewerbung als Programmierer/Softwareentwickler'}
${params.cvPath ? 'Lebenslauf ist beigefügt.' : ''}

Beginne mit "Betreff: ..." auf der ersten Zeile. Dann der HTML-Inhalt der E-Mail.`
      : `Write a professional job application email in English to "${params.companyName}".
Applicant: ${params.senderName}, Skills: ${params.senderSkills}
${params.jobTitle ? `Target position: ${params.jobTitle}` : 'Spontaneous application as software developer'}

Start with "Subject: ..." on the first line. Then the HTML body.`

  const response = await client.chat.completions.create({
    model: config.model,
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: prompt }
    ],
    temperature: 0.6
  })

  return response.choices[0]?.message?.content || ''
}
