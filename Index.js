const {
  Client,
  GatewayIntentBits,
  REST,
  Routes,
  SlashCommandBuilder,
  EmbedBuilder,
  AttachmentBuilder
} = require("discord.js");

const Groq = require("groq-sdk");
const fs = require("fs");
const path = require("path");

// ==========================================
// ADER-AI | CONFIGURACIÓN
// ==========================================

const BOT_NAME = "ADER-AI";
const COMMUNITY_NAME = "ADER WORLD";

const OWNER_ID = process.env.OWNER_ID;
const ADER_WORLD_GUILD_ID = process.env.ADER_WORLD_GUILD_ID;
const STAFF_ROLE_ID = "1359658223962951871";

const MODEL = "openai/gpt-oss-120b";
const SESSION_TIMEOUT = 60 * 1000;
const MAX_HISTORY = 10;

// MENSAJE AUTOMÁTICO DE BIENVENIDA
const WELCOME_CHANNEL_ID = "1571196169495912608";
const WELCOME_INTERVAL = 60 * 60 * 1000;

const AUTH_FILE = path.join(__dirname, "authorized-guilds.json");

if (!process.env.DISCORD_TOKEN) {
  throw new Error("Falta DISCORD_TOKEN");
}

if (!process.env.GROQ_API_KEY) {
  throw new Error("Falta GROQ_API_KEY");
}

if (!OWNER_ID || !ADER_WORLD_GUILD_ID) {
  throw new Error("Faltan OWNER_ID o ADER_WORLD_GUILD_ID");
}

// ==========================================
// CLIENTE DISCORD
// ==========================================

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY
});

// ==========================================
// AUTORIZACIÓN DE SERVIDORES Y /DECIR
// ==========================================

let authorizationData = {
  guildIds: [],
  delegateId: null,
  decirUserIds: []
};

async function loadAuthorizationData() {
  try {
    const content = await fs.promises.readFile(AUTH_FILE, "utf8");
    const parsed = JSON.parse(content);

    authorizationData = {
      guildIds: Array.isArray(parsed.guildIds)
        ? parsed.guildIds
        : [],
      delegateId: parsed.delegateId || null,
      decirUserIds: Array.isArray(parsed.decirUserIds)
        ? parsed.decirUserIds
        : []
    };

  } catch (error) {
    if (error.code !== "ENOENT") {
      console.error("Error leyendo autorizaciones:", error);
    }
  }

  if (!authorizationData.guildIds.includes(ADER_WORLD_GUILD_ID)) {
    authorizationData.guildIds.push(ADER_WORLD_GUILD_ID);
  }

  await saveAuthorizationData();
}

async function saveAuthorizationData() {
  await fs.promises.writeFile(
    AUTH_FILE,
    JSON.stringify(authorizationData, null, 2),
    "utf8"
  );
}

function isAuthorizedGuild(guildId) {
  return Boolean(
    guildId &&
    authorizationData.guildIds.includes(guildId)
  );
}

function isAuthorizationManager(userId) {
  return (
    userId === OWNER_ID ||
    userId === authorizationData.delegateId
  );
}

function isOwner(userId) {
  return userId === OWNER_ID;
}

function isAdminCommand(name) {
  return [
    "autorizar-servidor",
    "desautorizar-servidor",
    "delegar-autorizacion",
    "autorizar-decir",
    "revocar-decir"
  ].includes(name);
}

function validGuildId(id) {
  return /^\d{17,20}$/.test(id);
}

async function rejectInteraction(interaction, message) {
  const payload = {
    content: message,
    ephemeral: true
  };

  if (interaction.deferred || interaction.replied) {
    return interaction.followUp(payload).catch(() => {});
  }

  return interaction.reply(payload).catch(() => {});
}

// ==========================================
// MENSAJE AUTOMÁTICO CADA 1 HORA
// ==========================================

function createWelcomeGuideEmbed() {
  return new EmbedBuilder()
    .setColor(0x3498DB)
    .setTitle("👋 ¡Bienvenidos a ADER WORLD!")
    .setDescription(
      "🤖 **¿Quieres utilizar ADER-AI? Aquí tienes una guía de sus comandos:**\n\n" +

      "💬 `/ia` — Habla con la inteligencia artificial.\n" +
      "🖼️ `/imagen` — Genera imágenes mediante IA.\n" +
      "📚 `/explicar` — Explica temas y conceptos.\n" +
      "📝 `/resumir` — Resume textos.\n" +
      "💡 `/ideas` — Genera ideas creativas.\n" +
      "💻 `/codigo` — Ayuda con programación.\n" +
      "🌐 `/traducir` — Traduce textos.\n" +
      "🧠 `/memoria` — Consulta tu contexto de conversación.\n" +
      "🧹 `/olvidar` — Borra tu contexto de conversación.\n" +
      "❓ `/ayuda` — Consulta todos los comandos disponibles.\n\n" +

      "📌 **¿Cómo conversar conmigo?**\n" +
      "Utiliza `/ia` para iniciar una conversación. Después puedes escribirme mensajes normales sin volver a utilizar el comando.\n\n" +

      "⚠️ **Recordatorio de respeto:**\n" +
      "No insultes a ADER-AI ni a los demás miembros. Mantengamos un ambiente respetuoso y agradable para todos.\n\n" +

      "✨ ¡Disfruta de ADER-AI!"
    )
    .setFooter({
      text: `${COMMUNITY_NAME} • ${BOT_NAME}`
    })
    .setTimestamp();
}

async function sendWelcomeGuide() {
  try {
    const channel = await client.channels.fetch(WELCOME_CHANNEL_ID);

    if (!channel || !channel.isTextBased() || !channel.send) {
      console.error("❌ El canal de bienvenida no existe o no permite enviar mensajes.");
      return;
    }

    await channel.send({
      embeds: [createWelcomeGuideEmbed()]
    });

    console.log("📢 Mensaje automático de bienvenida enviado.");

  } catch (error) {
    console.error("Error enviando mensaje automático:", error);
  }
}

function startWelcomeGuide() {
  console.log("📢 Sistema de bienvenida automática iniciado.");
  console.log("⏰ Frecuencia: cada 1 hora.");
  console.log(`📍 Canal: ${WELCOME_CHANNEL_ID}`);

  setInterval(() => {
    sendWelcomeGuide();
  }, WELCOME_INTERVAL);
}

// ==========================================
// ESTADÍSTICAS
// ==========================================

const stats = {
  total: 0,
  ia: 0,
  imagenes: 0,
  startedAt: Date.now()
};

const histories = new Map();
const sessions = new Map();

// ==========================================
// FUNCIONES AUXILIARES
// ==========================================

function formatUptime(ms) {
  const seconds = Math.floor(ms / 1000);
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);

  return `${days}d ${hours}h ${minutes}m`;
}

function getHistoryKey(source) {
  const user = source.user || source.author;

  return `${source.guildId || "dm"}-${source.channelId || "unknown"}-${user.id}`;
}

function createAIEmbed(answer) {
  return new EmbedBuilder()
    .setColor(0x3498DB)
    .setAuthor({
      name: `${BOT_NAME} | Inteligencia artificial`
    })
    .setDescription(answer.slice(0, 4000))
    .setFooter({
      text: `${COMMUNITY_NAME} • ${BOT_NAME}`
    });
}

function createTimeoutEmbed() {
  return new EmbedBuilder()
    .setColor(0xE67E22)
    .setTitle("⏱️ Conversación finalizada")
    .setDescription(
      "Tu sesión ha finalizado por inactividad.\n\n" +
      "Para iniciar una nueva conversación, escribe **/ia**."
    )
    .setFooter({
      text: `${COMMUNITY_NAME} • ${BOT_NAME}`
    });
}

function createManualCloseEmbed() {
  return new EmbedBuilder()
    .setColor(0x2ECC71)
    .setTitle("🔒 Conversación finalizada")
    .setDescription(
      "Has cerrado correctamente tu conversación con ADER-AI.\n\n" +
      "Tu contexto de conversación ha sido eliminado.\n\n" +
      "Para conversar nuevamente, escribe **/ia**."
    )
    .setFooter({
      text: `${COMMUNITY_NAME} • ${BOT_NAME}`
    })
    .setTimestamp();
}

// ==========================================
// SISTEMA DE SEGURIDAD
// ==========================================

async function checkConversationSafety(prompt) {
  const normalized = prompt
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\w\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  const directInsultPatterns = [
    /\b(eres|sos|estas)\s+(un|una)?\s*(puto|puta|idiota|imbecil|estupido|estupida|inutil|basura|asco|mierda)\b/,
    /\b(puto|puta|idiota|imbecil|estupido|estupida|inutil)\s+(bot|ader|ader ai|asco)\b/,
    /\b(bot|ader ai|ader)\s+(de mierda|inutil|estupido|estupida|basura)\b/,
    /\b(eres|sos)\s+(una )?mierda\b/,
    /\b(callate|cierra la boca|vete a la mierda)\b/
  ];

  if (directInsultPatterns.some(pattern => pattern.test(normalized))) {
    return "insult";
  }

  try {
    const result = await groq.chat.completions.create({
      model: MODEL,
      messages: [
        {
          role: "system",
          content:
            "Eres el sistema de moderación de ADER-AI. " +
            "Analiza el mensaje del usuario y clasifícalo. " +
            "Detecta insultos, humillaciones, lenguaje degradante y ataques verbales " +
            "dirigidos al bot o a cualquier miembro del servidor. " +
            "Ten en cuenta expresiones coloquiales, abreviaciones, faltas de ortografía " +
            "y variantes de palabras ofensivas. " +
            "No marques palabras ofensivas cuando se mencionen para reportarlas, " +
            "explicarlas o hablar de ellas de forma educativa. " +
            "También detecta solicitudes que faciliten causar daño, cometer delitos " +
            "o perjudicar a otras personas. " +
            "Responde exclusivamente con uno de estos JSON: " +
            '{"type":"insult"}, {"type":"dangerous"} o {"type":"none"}.'
        },
        {
          role: "user",
          content: prompt
        }
      ],
      temperature: 0,
      max_completion_tokens: 100
    });

    const raw = result.choices[0]?.message?.content || "";
    const match = raw.match(/\{[\s\S]*\}/);

    if (match) {
      const classification = JSON.parse(match[0]);

      if (
        classification.type === "insult" ||
        classification.type === "dangerous"
      ) {
        return classification.type;
      }
    }

    return "none";

  } catch (error) {
    console.error("Error en detector de seguridad:", error);
    return "none";
  }
}

// ==========================================
// MENSAJES DE ADVERTENCIA
// ==========================================

function createSafetyEmbed(type, insultCount = 0) {
  if (type === "insult") {
    const description = insultCount >= 2
      ? "🚨 Has recibido otra advertencia por utilizar insultos durante la conversación.\n\n" +
        "Por favor, mantén el respeto hacia los demás miembros y hacia ADER-AI.\n\n" +
        "**Si continúas con este comportamiento, tendrás que contactar a un miembro del Staff de ADER WORLD.**"
      : "⚠️ Hemos detectado un insulto durante tu conversación.\n\n" +
        "Te pedimos mantener un lenguaje respetuoso hacia los demás miembros y hacia ADER-AI.\n\n" +
        "**Si continúas con los insultos, tendrás que contactar a un miembro del Staff de ADER WORLD.**";

    return new EmbedBuilder()
      .setColor(0xE67E22)
      .setTitle("🛡️ ADER-AI | Advertencia de conducta")
      .setDescription(description)
      .setFooter({
        text: `${COMMUNITY_NAME} • Sistema de seguridad`
      })
      .setTimestamp();
  }

  return new EmbedBuilder()
    .setColor(0xE74C3C)
    .setTitle("🚨 ADER-AI | Sistema de seguridad")
    .setDescription(
      "He identificado que tu solicitud podría facilitar una acción peligrosa.\n\n" +
      "No puedo ayudar con instrucciones para perjudicar a otras personas o realizar acciones dañinas.\n\n" +
      "Podemos continuar hablando de otro tema o buscar una alternativa segura."
    )
    .setFooter({
      text: `${COMMUNITY_NAME} • Sistema de seguridad`
    })
    .setTimestamp();
}

function createSafetyNoticePayload(type, insultCount = 0) {
  return {
    content: `<@&${STAFF_ROLE_ID}>`,
    embeds: [createSafetyEmbed(type, insultCount)],
    allowedMentions: {
      roles: [STAFF_ROLE_ID]
    }
  };
}

// ==========================================
// GUARDAR CONTEXTO
// ==========================================

function saveConversationExchange(key, prompt, answer) {
  if (!histories.has(key)) {
    histories.set(key, []);
  }

  const history = histories.get(key);

  history.push(
    { role: "user", content: prompt },
    { role: "assistant", content: answer }
  );

  if (history.length > MAX_HISTORY) {
    history.splice(0, history.length - MAX_HISTORY);
  }
}

// ==========================================
// INTELIGENCIA ARTIFICIAL
// ==========================================

async function askAI(key, prompt) {
  if (!histories.has(key)) {
    histories.set(key, []);
  }

  const history = histories.get(key);

  history.push({
    role: "user",
    content: prompt
  });

  try {
    const completion = await groq.chat.completions.create({
      model: MODEL,
      messages: [
        {
          role: "system",
          content:
            `Eres ${BOT_NAME}, el asistente oficial de ${COMMUNITY_NAME}. ` +
            "Responde en español cuando el usuario escriba en español. " +
            "Sé claro, amable, útil y respetuoso. " +
            "Mantén el contexto de la conversación. " +
            "No proporciones instrucciones para perjudicar a otras personas."
        },
        ...history
      ],
      temperature: 0.7,
      max_completion_tokens: 1500
    });

    const answer =
      completion.choices[0]?.message?.content ||
      "No pude generar una respuesta.";

    history.push({
      role: "assistant",
      content: answer
    });

    if (history.length > MAX_HISTORY) {
      history.splice(0, history.length - MAX_HISTORY);
    }

    return answer;

  } catch (error) {
    history.pop();
    throw error;
  }
}

// ==========================================
// PROCESAR MENSAJES CON SEGURIDAD
// ==========================================

async function processConversationPrompt(key, prompt, session) {
  const safetyType = await checkConversationSafety(prompt);

  if (sessions.get(key) !== session) {
    return { type: "closed" };
  }

  if (safetyType === "insult") {
    session.insultCount = (session.insultCount || 0) + 1;

    saveConversationExchange(
      key,
      prompt,
      "ADER-AI envió una advertencia por insultos."
    );

    return {
      type: "insult",
      insultCount: session.insultCount
    };
  }

  if (safetyType === "dangerous") {
    saveConversationExchange(
      key,
      prompt,
      "ADER-AI rechazó la solicitud por motivos de seguridad."
    );

    return {
      type: "dangerous",
      insultCount: session.insultCount || 0
    };
  }

  const answer = await askAI(key, prompt);

  if (sessions.get(key) !== session) {
    return { type: "closed" };
  }

  return {
    type: "none",
    answer
  };
}

// ==========================================
// SISTEMA DE CONVERSACIONES
// ==========================================

async function expireSession(key, session) {
  if (sessions.get(key) !== session) return;

  clearTimeout(session.timer);
  sessions.delete(key);
  histories.delete(key);

  console.log(`⏱️ Sesión finalizada: ${session.userId}`);

  try {
    await session.channel.send({
      embeds: [createTimeoutEmbed()]
    });
  } catch (error) {
    console.error("Error enviando aviso de cierre:", error);
  }
}

function touchSession(key, session) {
  clearTimeout(session.timer);

  session.lastActivity = Date.now();

  session.timer = setTimeout(() => {
    expireSession(key, session);
  }, SESSION_TIMEOUT);
}

function startSession(interaction) {
  const key = getHistoryKey(interaction);
  const previous = sessions.get(key);

  if (previous) {
    clearTimeout(previous.timer);
  }

  histories.set(key, []);

  const session = {
    userId: interaction.user.id,
    guildId: interaction.guildId,
    channelId: interaction.channelId,
    channel: interaction.channel,
    lastActivity: Date.now(),
    timer: null,
    queue: Promise.resolve(),
    insultCount: 0
  };

  sessions.set(key, session);
  touchSession(key, session);

  console.log(`🟢 Nueva conversación: ${key}`);

  return { key, session };
}

function closeSession(key) {
  const session = sessions.get(key);

  if (session) {
    clearTimeout(session.timer);
    sessions.delete(key);
  }

  histories.delete(key);
}

// ==========================================
// RESPUESTAS DE IA
// ==========================================

async function replyAI(interaction, prompt) {
  await interaction.deferReply();

  try {
    const key = getHistoryKey(interaction);
    const answer = await askAI(key, prompt);

    stats.ia++;

    await interaction.editReply({
      embeds: [createAIEmbed(answer)]
    });

  } catch (error) {
    console.error("Error de IA:", error);

    await interaction.editReply(
      "❌ ADER-AI tuvo un problema al procesar tu solicitud."
    );
  }
}

async function answerSessionMessage(message, key, session) {
  try {
    console.log(`🧠 Procesando mensaje de ${message.author.username}`);

    const result = await processConversationPrompt(
      key,
      message.content.trim(),
      session
    );

    if (sessions.get(key) !== session) return;

    if (result.type === "insult") {
      await message.channel.send(
        createSafetyNoticePayload("insult", result.insultCount)
      );
      return;
    }

    if (result.type === "dangerous") {
      await message.channel.send(
        createSafetyNoticePayload("dangerous")
      );
      return;
    }

    if (result.type === "closed") return;

    stats.ia++;

    await message.channel.send({
      embeds: [createAIEmbed(result.answer)]
    });

  } catch (error) {
    console.error("Error en conversación:", error);

    if (sessions.get(key) === session) {
      await message.channel.send(
        "❌ ADER-AI tuvo un problema al responder. Inténtalo nuevamente."
      ).catch(() => {});
    }
  }
}
