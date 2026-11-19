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
// MEJORA DE DESCRIPCIONES PARA /IMAGEN
// ==========================================

async function enhanceImagePrompt(description) {
  try {
    const completion = await groq.chat.completions.create({
      model: MODEL,
      messages: [
        {
          role: "system",
          content:
            "Eres un experto en creación de prompts para generación de imágenes. " +
            "Reescribe la descripción del usuario en un prompt preciso, detallado y claro en inglés. " +
            "Conserva todos los objetos, personas, animales, colores, posiciones, acciones, " +
            "fondos, estilos y detalles visuales que haya solicitado. " +
            "No elimines, sustituyas ni contradigas ningún detalle solicitado. " +
            "No inventes sujetos u objetos adicionales. " +
            "Si el usuario solicita texto dentro de la imagen, conserva exactamente ese texto. " +
            "Puedes mejorar la claridad, composición, iluminación y calidad visual sin cambiar " +
            "la idea original. " +
            "No añadas explicaciones, introducciones ni comillas. " +
            "Devuelve únicamente el prompt final."
        },
        {
          role: "user",
          content: description
        }
      ],
      temperature: 0.2,
      max_completion_tokens: 700
    });

    const improved =
      completion.choices[0]?.message?.content?.trim();

    return improved || description;

  } catch (error) {
    console.error("Error mejorando descripción de imagen:", error);
    return description;
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

// ==========================================
// COMANDOS NORMALES
// ==========================================

const normalCommands = [
  new SlashCommandBuilder()
    .setName("ayuda")
    .setDescription("Muestra todos los comandos de ADER-AI"),

  new SlashCommandBuilder()
    .setName("ping")
    .setDescription("Comprueba la conexión de ADER-AI"),

  new SlashCommandBuilder()
    .setName("estado")
    .setDescription("Muestra el estado de ADER-AI"),

  new SlashCommandBuilder()
    .setName("ia")
    .setDescription("Inicia una conversación con ADER-AI")
    .addStringOption(option =>
      option.setName("pregunta")
        .setDescription("Pregunta inicial (opcional)")
        .setRequired(false)
    ),

  new SlashCommandBuilder()
    .setName("explicar")
    .setDescription("Solicita una explicación a ADER-AI")
    .addStringOption(option =>
      option.setName("tema")
        .setDescription("Tema que deseas comprender")
        .setRequired(true)
    ),

  new SlashCommandBuilder()
    .setName("resumir")
    .setDescription("Resume un texto con ADER-AI")
    .addStringOption(option =>
      option.setName("texto")
        .setDescription("Texto que deseas resumir")
        .setRequired(true)
    ),

  new SlashCommandBuilder()
    .setName("ideas")
    .setDescription("Genera ideas creativas")
    .addStringOption(option =>
      option.setName("tema")
        .setDescription("Tema para generar ideas")
        .setRequired(true)
    ),

  new SlashCommandBuilder()
    .setName("codigo")
    .setDescription("Obtén ayuda con programación")
    .addStringOption(option =>
      option.setName("consulta")
        .setDescription("Tu duda de programación")
        .setRequired(true)
    ),

  new SlashCommandBuilder()
    .setName("traducir")
    .setDescription("Traduce textos")
    .addStringOption(option =>
      option.setName("texto")
        .setDescription("Texto que deseas traducir")
        .setRequired(true)
    )
    .addStringOption(option =>
      option.setName("idioma")
        .setDescription("Idioma al que deseas traducir")
        .setRequired(true)
    ),

  new SlashCommandBuilder()
    .setName("memoria")
    .setDescription("Consulta tu contexto de conversación"),

  new SlashCommandBuilder()
    .setName("olvidar")
    .setDescription("Borra tu contexto de conversación"),

  new SlashCommandBuilder()
    .setName("imagen")
    .setDescription("Genera una imagen con ADER-AI")
    .addStringOption(option =>
      option.setName("descripcion")
        .setDescription("Describe la imagen que deseas crear")
        .setRequired(true)
    ),

  new SlashCommandBuilder()
    .setName("servidor")
    .setDescription("Muestra información del servidor"),

  new SlashCommandBuilder()
    .setName("usuario")
    .setDescription("Muestra información de un usuario")
    .addUserOption(option =>
      option.setName("miembro")
        .setDescription("Usuario que deseas consultar")
        .setRequired(false)
    ),

  new SlashCommandBuilder()
    .setName("decir")
    .setDescription("Envía un mensaje mediante ADER-AI")
    .addStringOption(option =>
      option.setName("mensaje")
        .setDescription("Mensaje que deseas enviar")
        .setRequired(true)
    )
].map(command => command.toJSON());

// ==========================================
// COMANDOS ADMINISTRATIVOS
// Solo se registran en ADER WORLD
// ==========================================

const adminCommands = [
  new SlashCommandBuilder()
    .setName("autorizar-servidor")
    .setDescription("Autoriza un servidor para utilizar ADER-AI")
    .addStringOption(option =>
      option.setName("servidor_id")
        .setDescription("ID del servidor que deseas autorizar")
        .setRequired(true)
    ),

  new SlashCommandBuilder()
    .setName("desautorizar-servidor")
    .setDescription("Retira la autorización de un servidor")
    .addStringOption(option =>
      option.setName("servidor_id")
        .setDescription("ID del servidor que deseas desautorizar")
        .setRequired(true)
    ),

  new SlashCommandBuilder()
    .setName("delegar-autorizacion")
    .setDescription("Designa o retira a la persona autorizada para administrar servidores")
    .addUserOption(option =>
      option.setName("usuario")
        .setDescription("Persona a delegar; omítela para retirar la delegación")
        .setRequired(false)
    ),

  new SlashCommandBuilder()
    .setName("autorizar-decir")
    .setDescription("Autoriza a un usuario para utilizar /decir")
    .addUserOption(option =>
      option.setName("usuario")
        .setDescription("Usuario que podrá utilizar /decir")
        .setRequired(true)
    ),

  new SlashCommandBuilder()
    .setName("revocar-decir")
    .setDescription("Retira el permiso de utilizar /decir")
    .addUserOption(option =>
      option.setName("usuario")
        .setDescription("Usuario al que se le retirará el permiso")
        .setRequired(true)
    )
].map(command => command.toJSON());

// ==========================================
// REGISTRO DE COMANDOS
// ==========================================

client.once("ready", async () => {
  console.log(`🤖 ${BOT_NAME} está conectado.`);
  console.log(`Conectado como ${client.user.tag}`);

  try {
    await loadAuthorizationData();

    const rest = new REST({ version: "10" })
      .setToken(process.env.DISCORD_TOKEN);

    await rest.put(
      Routes.applicationCommands(client.user.id),
      { body: normalCommands }
    );

    await rest.put(
      Routes.applicationGuildCommands(
        client.user.id,
        ADER_WORLD_GUILD_ID
      ),
      { body: adminCommands }
    );

    console.log("✅ Comandos normales registrados.");
    console.log("🔐 Comandos administrativos registrados en ADER WORLD.");
    console.log("🛡️ Sistema de servidores autorizados preparado.");
    console.log("💾 Autorizaciones y permisos de /decir cargados.");

    startWelcomeGuide();

  } catch (error) {
    console.error("Error durante la configuración:", error);
  }
});

// ==========================================
// DETECTOR DE MENSAJES
// ==========================================

client.on("messageCreate", async message => {
  if (message.author.bot) return;
  if (!message.guild) return;

  if (!isAuthorizedGuild(message.guild.id)) {
    return;
  }

  const content = message.content.trim();

  if (!content) return;

  const key = getHistoryKey(message);
  const session = sessions.get(key);

  if (!session) return;

  if (Date.now() - session.lastActivity >= SESSION_TIMEOUT) {
    await expireSession(key, session);
    return;
  }

  if (/^cerrar\s+conversaci[oó]n[.!?]*$/i.test(content)) {
    closeSession(key);

    await message.channel.send({
      embeds: [createManualCloseEmbed()]
    }).catch(error => {
      console.error("Error enviando confirmación:", error);
    });

    return;
  }

  touchSession(key, session);

  session.queue = session.queue
    .then(async () => {
      if (sessions.get(key) !== session) return;

      await answerSessionMessage(message, key, session);
    })
    .catch(error => {
      console.error("Error en la cola:", error);
    });
});

// ==========================================
// INTERACCIONES
// ==========================================

client.on("interactionCreate", async interaction => {
  if (!interaction.isChatInputCommand()) return;

  const name = interaction.commandName;

  if (!interaction.guildId) {
    return rejectInteraction(
      interaction,
      "🔒 ADER-AI solo funciona en servidores autorizados."
    );
  }

  if (!isAuthorizedGuild(interaction.guildId)) {
    return rejectInteraction(
      interaction,
      "🔒 Este servidor no está autorizado para utilizar ADER-AI."
    );
  }

  if (
    isAdminCommand(name) &&
    interaction.guildId !== ADER_WORLD_GUILD_ID
  ) {
    return rejectInteraction(
      interaction,
      "🔒 Los comandos administrativos solo funcionan en ADER WORLD."
    );
  }

  if (
    isAdminCommand(name) &&
    !isAuthorizationManager(interaction.user.id)
  ) {
    return rejectInteraction(
      interaction,
      "⛔ No tienes autorización para administrar los servidores de ADER-AI."
    );
  }

  stats.total++;

  try {

    // ======================================
    // AUTORIZAR SERVIDOR
    // ======================================

    if (name === "autorizar-servidor") {
      const guildId = interaction.options.getString("servidor_id").trim();

      if (!validGuildId(guildId)) {
        return interaction.reply({
          content: "❌ El ID del servidor no tiene un formato válido.",
          ephemeral: true
        });
      }

      if (authorizationData.guildIds.includes(guildId)) {
        return interaction.reply({
          content: "ℹ️ Ese servidor ya está autorizado.",
          ephemeral: true
        });
      }

      authorizationData.guildIds.push(guildId);
      await saveAuthorizationData();

      const embed = new EmbedBuilder()
        .setColor(0x2ECC71)
        .setTitle("🔓 Servidor autorizado")
        .setDescription(
          `El servidor con ID \`${guildId}\` ya puede utilizar ADER-AI.\n\n` +
          "La autorización quedó guardada permanentemente."
        )
        .setFooter({ text: "ADER-AI | Sistema de autorizaciones" })
        .setTimestamp();

      return interaction.reply({
        embeds: [embed],
        ephemeral: true
      });
    }

    // ======================================
    // DESAUTORIZAR SERVIDOR
    // ======================================

    if (name === "desautorizar-servidor") {
      const guildId = interaction.options.getString("servidor_id").trim();

      if (!validGuildId(guildId)) {
        return interaction.reply({
          content: "❌ El ID del servidor no tiene un formato válido.",
          ephemeral: true
        });
      }

      if (guildId === ADER_WORLD_GUILD_ID) {
        return interaction.reply({
          content: "⛔ ADER WORLD no puede ser desautorizado.",
          ephemeral: true
        });
      }

      if (!authorizationData.guildIds.includes(guildId)) {
        return interaction.reply({
          content: "ℹ️ Ese servidor no estaba autorizado.",
          ephemeral: true
        });
      }

      authorizationData.guildIds =
        authorizationData.guildIds.filter(id => id !== guildId);

      await saveAuthorizationData();

      for (const [key, session] of sessions.entries()) {
        if (session.guildId === guildId) {
          clearTimeout(session.timer);
          sessions.delete(key);
          histories.delete(key);
        }
      }

      const embed = new EmbedBuilder()
        .setColor(0xE74C3C)
        .setTitle("🔒 Servidor desautorizado")
        .setDescription(
          `Se retiró el permiso del servidor \`${guildId}\`.\n\n` +
          "ADER-AI ya no responderá allí."
        )
        .setFooter({ text: "ADER-AI | Sistema de autorizaciones" })
        .setTimestamp();

      return interaction.reply({
        embeds: [embed],
        ephemeral: true
      });
    }

    // ======================================
    // DELEGAR AUTORIZACIÓN
    // ======================================

    if (name === "delegar-autorizacion") {
      if (!isOwner(interaction.user.id)) {
        return interaction.reply({
          content: "⛔ Solo el propietario puede delegar permisos.",
          ephemeral: true
        });
      }

      const user = interaction.options.getUser("usuario");

      if (!user) {
        authorizationData.delegateId = null;
        await saveAuthorizationData();

        return interaction.reply({
          content: "🔒 Se retiró la delegación. Ahora solo el propietario puede administrar servidores.",
          ephemeral: true
        });
      }

      if (user.bot) {
        return interaction.reply({
          content: "❌ No puedes delegar permisos a un bot.",
          ephemeral: true
        });
      }

      if (user.id === OWNER_ID) {
        return interaction.reply({
          content: "ℹ️ Esa persona ya es el propietario.",
          ephemeral: true
        });
      }

      authorizationData.delegateId = user.id;
      await saveAuthorizationData();

      const embed = new EmbedBuilder()
        .setColor(0x3498DB)
        .setTitle("🛡️ Delegación actualizada")
        .setDescription(
          `Se ha delegado la administración de servidores a ${user}.\n\n` +
          "Esta persona podrá autorizar y desautorizar servidores desde ADER WORLD.\n\n" +
          "**Solo el propietario puede cambiar o retirar esta delegación.**"
        )
        .setFooter({ text: "ADER-AI | Administración" })
        .setTimestamp();

      return interaction.reply({
        embeds: [embed],
        ephemeral: true
      });
    }

    // ======================================
    // AUTORIZAR /DECIR
    // ======================================

    if (name === "autorizar-decir") {
      if (!isOwner(interaction.user.id)) {
        return interaction.reply({
          content: "⛔ Solo el propietario puede autorizar usuarios para /decir.",
          ephemeral: true
        });
      }

      const user = interaction.options.getUser("usuario");

      if (user.bot) {
        return interaction.reply({
          content: "❌ No puedes autorizar bots.",
          ephemeral: true
        });
      }

      if (user.id === OWNER_ID) {
        return interaction.reply({
          content: "ℹ️ Esa persona ya es el propietario.",
          ephemeral: true
        });
      }

      if (authorizationData.decirUserIds.includes(user.id)) {
        return interaction.reply({
          content: "ℹ️ Ese usuario ya tiene permiso para utilizar /decir.",
          ephemeral: true
        });
      }

      authorizationData.decirUserIds.push(user.id);
      await saveAuthorizationData();

      return interaction.reply({
        content: `✅ ${user} ahora puede utilizar /decir. El permiso quedó guardado.`,
        allowedMentions: {
          users: [user.id]
        },
        ephemeral: true
      });
    }

    // ======================================
    // REVOCAR /DECIR
    // ======================================

    if (name === "revocar-decir") {
      if (!isOwner(interaction.user.id)) {
        return interaction.reply({
          content: "⛔ Solo el propietario puede retirar permisos de /decir.",
          ephemeral: true
        });
      }

      const user = interaction.options.getUser("usuario");

      if (!authorizationData.decirUserIds.includes(user.id)) {
        return interaction.reply({
          content: "ℹ️ Ese usuario no tiene permiso para utilizar /decir.",
          ephemeral: true
        });
      }

      authorizationData.decirUserIds =
        authorizationData.decirUserIds.filter(id => id !== user.id);

      await saveAuthorizationData();

      return interaction.reply({
        content: `🔒 Se retiró el permiso de /decir a ${user}.`,
        allowedMentions: {
          users: [user.id]
        },
        ephemeral: true
      });
    }

    // ======================================
    // AYUDA
    // ======================================

    if (name === "ayuda") {
      const embed = new EmbedBuilder()
        .setColor(0x3498DB)
        .setTitle("🤖 ADER-AI | CENTRO DE COMANDOS")
        .setDescription("Bienvenido al centro de ayuda de ADER-AI.")
        .addFields(
          {
            name: "🧠 Inteligencia artificial",
            value: "`/ia` `/explicar` `/resumir` `/ideas` `/codigo` `/traducir`"
          },
          {
            name: "🎨 Creatividad",
            value: "`/imagen`"
          },
          {
            name: "🧠 Memoria",
            value: "`/memoria` `/olvidar`"
          },
          {
            name: "⚙️ Utilidades",
            value: "`/ping` `/estado` `/servidor` `/usuario` `/decir`"
          },
          {
            name: "💬 Conversaciones",
            value: "Usa `/ia` una vez y continúa escribiendo mensajes normales. Escribe `cerrar conversación` para finalizarla. También se cierra tras 60 segundos de inactividad."
          }
        )
        .setThumbnail(client.user.displayAvatarURL())
        .setFooter({ text: `${COMMUNITY_NAME} • ${BOT_NAME}` });

      return interaction.reply({ embeds: [embed] });
    }

    // ======================================
    // PING
    // ======================================

    if (name === "ping") {
      const embed = new EmbedBuilder()
        .setColor(0x2ECC71)
        .setTitle("🏓 ADER-AI | CONEXIÓN")
        .addFields({
          name: "Latencia",
          value: `${client.ws.ping} ms`,
          inline: true
        })
        .setFooter({ text: `${COMMUNITY_NAME} • ${BOT_NAME}` });

      return interaction.reply({ embeds: [embed] });
    }

    // ======================================
    // ESTADO
    // ======================================

    if (name === "estado") {
      const embed = new EmbedBuilder()
        .setColor(0x3498DB)
        .setTitle("📊 ADER-AI • SYSTEM MONITOR")
        .setThumbnail(client.user.displayAvatarURL())
        .addFields(
          { name: "🟢 Estado", value: "En línea", inline: true },
          { name: "🏓 Latencia", value: `${client.ws.ping} ms`, inline: true },
          { name: "⏱️ Tiempo activo", value: formatUptime(Date.now() - stats.startedAt), inline: true },
          { name: "📈 Comandos utilizados", value: `${stats.total}`, inline: true },
          { name: "🧠 Consultas de IA", value: `${stats.ia}`, inline: true },
          { name: "🎨 Imágenes solicitadas", value: `${stats.imagenes}`, inline: true },
          { name: "🌎 Servidores", value: `${client.guilds.cache.size}`, inline: true },
          { name: "👥 Usuarios en caché", value: `${client.users.cache.size}`, inline: true },
          { name: "💬 Sesiones activas", value: `${sessions.size}`, inline: true },
          { name: "🔐 Servidores autorizados", value: `${authorizationData.guildIds.length}`, inline: true }
        )
        .setFooter({ text: `${COMMUNITY_NAME} • ${BOT_NAME} SYSTEM` })
        .setTimestamp();

      return interaction.reply({ embeds: [embed] });
    }

    // ======================================
    // IA
    // ======================================

    if (name === "ia") {
      const { key, session } = startSession(interaction);
      const prompt = interaction.options.getString("pregunta");

      if (prompt) {
        await interaction.deferReply();

        try {
          const result = await processConversationPrompt(key, prompt, session);

          if (sessions.get(key) !== session) return;

          if (result.type === "insult") {
            session.insultCount = result.insultCount;

            const notice = createSafetyNoticePayload(
              "insult",
              result.insultCount
            );

            notice.content = `<@${interaction.user.id}> ${notice.content}`;
            notice.allowedMentions.users = [interaction.user.id];

            return interaction.editReply(notice);
          }

          if (result.type === "dangerous") {
            const notice = createSafetyNoticePayload("dangerous");

            notice.content = `<@${interaction.user.id}> ${notice.content}`;
            notice.allowedMentions.users = [interaction.user.id];

            return interaction.editReply(notice);
          }

          if (result.type === "closed") return;

          stats.ia++;

          return interaction.editReply({
            content: `<@${interaction.user.id}>`,
            embeds: [createAIEmbed(result.answer)],
            allowedMentions: {
              users: [interaction.user.id]
            }
          });

        } catch (error) {
          console.error("Error de IA:", error);

          return interaction.editReply({
            content: `<@${interaction.user.id}>`,
            embeds: [
              new EmbedBuilder()
                .setColor(0xE74C3C)
                .setDescription("❌ ADER-AI tuvo un problema al procesar tu pregunta.")
            ],
            allowedMentions: {
              users: [interaction.user.id]
            }
          });
        }
      }

      const embed = new EmbedBuilder()
        .setColor(0x3498DB)
        .setTitle("💬 Conversación iniciada")
        .setDescription(
          `¡Hola, ${interaction.user.username}!\n\n` +
          "Ya puedes conversar conmigo escribiendo mensajes normales. " +
          "No necesitas volver a utilizar `/ia`.\n\n" +
          "🔒 Cuando termines, escribe **cerrar conversación** para finalizar.\n\n" +
          "⏱️ La conversación finalizará después de 60 segundos sin actividad."
        )
        .setFooter({ text: `${COMMUNITY_NAME} • ${BOT_NAME}` });

      return interaction.reply({
        content: `<@${interaction.user.id}>`,
        embeds: [embed],
        allowedMentions: {
          users: [interaction.user.id]
        }
      });
    }

    // ======================================
    // EXPLICAR
    // ======================================

    if (name === "explicar") {
      const tema = interaction.options.getString("tema");
      return replyAI(interaction, `Explícame de manera clara y sencilla: ${tema}`);
    }

    // ======================================
    // RESUMIR
    // ======================================

    if (name === "resumir") {
      const texto = interaction.options.getString("texto");
      return replyAI(interaction, `Resume el siguiente texto de forma clara: ${texto}`);
    }

    // ======================================
    // IDEAS
    // ======================================

    if (name === "ideas") {
      const tema = interaction.options.getString("tema");
      return replyAI(interaction, `Dame ideas creativas sobre: ${tema}`);
    }

    // ======================================
    // CODIGO
    // ======================================

    if (name === "codigo") {
      const consulta = interaction.options.getString("consulta");
      return replyAI(interaction, `Ayúdame con esta consulta de programación: ${consulta}`);
    }

    // ======================================
    // TRADUCIR
    // ======================================

    if (name === "traducir") {
      const texto = interaction.options.getString("texto");
      const idioma = interaction.options.getString("idioma");

      return replyAI(
        interaction,
        `Traduce al idioma ${idioma} este texto: ${texto}`
      );
    }

    // ======================================
    // MEMORIA
    // ======================================

    if (name === "memoria") {
      const key = getHistoryKey(interaction);
      const history = histories.get(key) || [];
      const active = sessions.has(key);

      const embed = new EmbedBuilder()
        .setColor(0x3498DB)
        .setTitle("🧠 ADER-AI | MEMORIA")
        .setDescription(
          history.length
            ? `Tengo ${history.length} mensajes de contexto de esta conversación.`
            : "Todavía no tengo contexto guardado de esta conversación."
        )
        .addFields({
          name: "Estado de sesión",
          value: active ? "🟢 Activa" : "⚪ Sin sesión activa"
        })
        .setFooter({ text: `${COMMUNITY_NAME} • ${BOT_NAME}` });

      return interaction.reply({
        embeds: [embed],
        ephemeral: true
      });
    }

    // ======================================
    // OLVIDAR
    // ======================================

    if (name === "olvidar") {
      const key = getHistoryKey(interaction);

      closeSession(key);

      return interaction.reply({
        content: "🧹 Tu contexto ha sido borrado y tu conversación ha sido cerrada.",
        ephemeral: true
      });
    }

    // ======================================
    // IMAGEN
    // ======================================

    if (name === "imagen") {
      await interaction.deferReply();

      const prompt = interaction.options.getString("descripcion");

      if (!process.env.POLLINATIONS_API_KEY) {
        return interaction.editReply(
          "❌ Falta configurar POLLINATIONS_API_KEY."
        );
      }

      try {
        // Primero mejora y organiza la descripción con Groq
        const improvedPrompt = await enhanceImagePrompt(prompt);

        console.log("📝 Descripción original:", prompt);
        console.log("🎨 Descripción mejorada:", improvedPrompt);

        const url =
          "https://gen.pollinations.ai/image/" +
          encodeURIComponent(improvedPrompt) +
          "?model=flux&width=1024&height=1024&nologo=true";

        const response = await fetch(url, {
          headers: {
            Authorization: `Bearer ${process.env.POLLINATIONS_API_KEY}`
          },
          signal: AbortSignal.timeout(120000)
        });

        if (!response.ok) {
          throw new Error(`Pollinations respondió con código ${response.status}`);
        }

        const buffer = Buffer.from(await response.arrayBuffer());

        const image = new AttachmentBuilder(buffer, {
          name: "ader-ai-imagen.png"
        });

        const embed = new EmbedBuilder()
          .setColor(0x3498DB)
          .setTitle("🎨 ADER-AI | IMAGEN GENERADA")
          .setDescription(`**Descripción:** ${prompt}`)
          .setImage("attachment://ader-ai-imagen.png")
          .setFooter({ text: `Creado con ${BOT_NAME} • ${COMMUNITY_NAME}` });

        stats.imagenes++;

        return interaction.editReply({
          embeds: [embed],
          files: [image]
        });

      } catch (error) {
        console.error("Error generando imagen:", error);

        return interaction.editReply(
          "❌ No pude generar la imagen. Inténtalo nuevamente."
        );
      }
    }

    // ======================================
    // SERVIDOR
    // ======================================

    if (name === "servidor") {
      const guild = interaction.guild;

      if (!guild) {
        return interaction.reply({
          content: "Este comando solo funciona dentro de un servidor.",
          ephemeral: true
        });
      }

      const embed = new EmbedBuilder()
        .setColor(0x3498DB)
        .setTitle("🌎 ADER-AI | INFORMACIÓN DEL SERVIDOR")
        .setThumbnail(guild.iconURL())
        .addFields(
          { name: "Nombre", value: guild.name, inline: true },
          { name: "Miembros", value: `${guild.memberCount}`, inline: true },
          { name: "Canales", value: `${guild.channels.cache.size}`, inline: true }
        )
        .setFooter({ text: `${COMMUNITY_NAME} • ${BOT_NAME}` });

      return interaction.reply({ embeds: [embed] });
    }

    // ======================================
    // USUARIO
    // ======================================

    if (name === "usuario") {
      const user =
        interaction.options.getUser("miembro") ||
        interaction.user;

      const embed = new EmbedBuilder()
        .setColor(0x3498DB)
        .setTitle("👤 ADER-AI | INFORMACIÓN DEL USUARIO")
        .setThumbnail(user.displayAvatarURL())
        .addFields(
          { name: "Usuario", value: user.username, inline: true },
          { name: "ID", value: user.id, inline: true },
          {
            name: "Cuenta creada",
            value: `<t:${Math.floor(user.createdTimestamp / 1000)}:D>`,
            inline: true
          }
        )
        .setFooter({ text: `${COMMUNITY_NAME} • ${BOT_NAME}` });

      return interaction.reply({ embeds: [embed] });
    }

    // ======================================
    // DECIR - PROPIETARIO Y USUARIOS AUTORIZADOS
    // ======================================

    if (name === "decir") {
      const hasPermission =
        isOwner(interaction.user.id) ||
        authorizationData.decirUserIds.includes(interaction.user.id);

      if (!hasPermission) {
        return interaction.reply({
          content: "🔒 No tienes autorización para utilizar este comando.",
          ephemeral: true
        });
      }

      const mensaje = interaction.options.getString("mensaje");

      await interaction.deferReply({
        ephemeral: true
      });

      await interaction.channel.send({
        content: mensaje,
        allowedMentions: {
          parse: []
        }
      });

      return interaction.editReply({
        content: "✅ Mensaje publicado por ADER-AI."
      });
    }

  } catch (error) {
    console.error(`Error en ${name}:`, error);

    const errorMessage =
      "❌ ADER-AI encontró un error al ejecutar este comando.";

    if (interaction.deferred || interaction.replied) {
      await interaction.editReply(errorMessage).catch(() => {});
    } else {
      await interaction.reply({
        content: errorMessage,
        ephemeral: true
      }).catch(() => {});
    }
  }
});

// ==========================================
// CONEXIÓN
// ==========================================

client.login(process.env.DISCORD_TOKEN);
