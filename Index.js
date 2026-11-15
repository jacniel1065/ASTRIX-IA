
const {
  Client,
  GatewayIntentBits,
  REST,
  Routes,
  SlashCommandBuilder,
  Events,
  EmbedBuilder
} = require("discord.js");

const OpenAI = require("openai");

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

const PREFIX = "a!";
const MODEL = "gpt-4.1-mini";
const conversations = new Map();

if (!process.env.DISCORD_TOKEN ||
    !process.env.OPENAI_API_KEY) {
  console.error("Faltan variables privadas.");
  process.exit(1);
}

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

const commands = [
  new SlashCommandBuilder()
    .setName("ayuda")
    .setDescription("Centro de ayuda de ASTRIX AI"),

  new SlashCommandBuilder()
    .setName("ping")
    .setDescription("Comprueba la latencia"),

  new SlashCommandBuilder()
    .setName("ia")
    .setDescription("Habla con ASTRIX AI")
    .addStringOption(o =>
      o.setName("pregunta")
        .setDescription("Tu pregunta")
        .setRequired(true)
        .setMaxLength(1000)),

  new SlashCommandBuilder()
    .setName("explicar")
    .setDescription("Explica cualquier tema")
    .addStringOption(o =>
      o.setName("tema")
        .setDescription("Tema que quieres aprender")
        .setRequired(true)
        .setMaxLength(1000)),

  new SlashCommandBuilder()
    .setName("resumir")
    .setDescription("Resume un texto")
    .addStringOption(o =>
      o.setName("texto")
        .setDescription("Texto para resumir")
        .setRequired(true)
        .setMaxLength(1000)),

  new SlashCommandBuilder()
    .setName("ideas")
    .setDescription("Genera ideas creativas")
    .addStringOption(o =>
      o.setName("tema")
        .setDescription("Tema de las ideas")
        .setRequired(true)
        .setMaxLength(1000)),

  new SlashCommandBuilder()
    .setName("codigo")
    .setDescription("Ayuda con programación")
    .addStringOption(o =>
      o.setName("problema")
        .setDescription("Describe lo que necesitas")
        .setRequired(true)
        .setMaxLength(1000)),

  new SlashCommandBuilder()
    .setName("traducir")
    .setDescription("Traduce textos")
    .addStringOption(o =>
      o.setName("texto")
        .setDescription("Texto para traducir")
        .setRequired(true)
        .setMaxLength(1000))
    .addStringOption(o =>
      o.setName("idioma")
        .setDescription("Idioma de destino")
        .setRequired(true)
        .setMaxLength(50)),

  new SlashCommandBuilder()
    .setName("memoria")
    .setDescription("Consulta el estado de tu memoria"),

  new SlashCommandBuilder()
    .setName("olvidar")
    .setDescription("Borra tu contexto de conversación"),

  new SlashCommandBuilder()
    .setName("estado")
    .setDescription("Estado de ASTRIX AI"),

  new SlashCommandBuilder()
    .setName("servidor")
    .setDescription("Información del servidor"),

  new SlashCommandBuilder()
    .setName("usuario")
    .setDescription("Información de un usuario")
    .addUserOption(o =>
      o.setName("miembro")
        .setDescription("Usuario que quieres consultar")
        .setRequired(false)),

  new SlashCommandBuilder()
    .setName("decir")
    .setDescription("Envía un mensaje como el bot")
    .addStringOption(o =>
      o.setName("mensaje")
        .setDescription("Mensaje")
        .setRequired(true))
];

function memoryKey(guildId, userId) {
  return `${guildId}:${userId}`;
}

async function askAI(question, guildId, userId) {
  const key = memoryKey(guildId, userId);
  const history = conversations.get(key) || [];

  const response = await openai.responses.create({
    model: MODEL,
    instructions:
      "Eres ASTRIX AI, un asistente inteligente, amable y profesional. " +
      "Responde en español, explica claramente y adapta tus respuestas " +
      "al contexto de la conversación. No inventes información.",
    input: [
      ...history,
      { role: "user", content: question }
    ]
  });

  const answer = (
    response.output_text || "No pude generar una respuesta."
  ).slice(0, 1900);

  const updated = [
    ...history,
    { role: "user", content: question },
    { role: "assistant", content: answer }
  ].slice(-10);

  conversations.set(key, updated);

  return answer;
}

function helpEmbed() {
  return new EmbedBuilder()
    .setColor(0x5865F2)
    .setAuthor({
      name: "ASTRIX AI • Sistema inteligente"
    })
    .setTitle("✨ Centro de ayuda")
    .setDescription(
      "Bienvenido a ASTRIX AI.\n" +
      "Tu asistente inteligente para aprender, crear y resolver dudas.\n\n" +
      "**Prefijo de conversación:** `a!`"
    )
    .addFields(
      {
        name: "🧠 Inteligencia artificial",
        value:
          "`a! pregunta` — Conversar con IA.\n" +
          "`/ia` — Hacer preguntas.\n" +
          "`/explicar` — Aprender temas."
      },
      {
        name: "✨ Herramientas creativas",
        value:
          "`/ideas` — Generar ideas.\n" +
          "`/resumir` — Resumir textos.\n" +
          "`/traducir` — Traducir idiomas.\n" +
          "`/codigo` — Ayuda con programación."
      },
      {
        name: "💾 Memoria",
        value:
          "`/memoria` — Consultar tu contexto.\n" +
          "`/olvidar` — Borrar tu contexto."
      },
      {
        name: "⚙️ Sistema",
        value:
          "`/ping` — Latencia.\n" +
          "`/estado` — Estado del bot.\n" +
          "`/servidor` — Información del servidor.\n" +
          "`/usuario` — Información de usuarios.\n" +
          "`/decir` — Enviar mensajes."
      }
    )
    .setFooter({
      text: "ASTRIX AI • Tu asistente inteligente"
    })
    .setTimestamp();
}

client.once(Events.ClientReady, async bot => {
  console.log(`ASTRIX AI conectado como ${bot.user.tag}`);

  const rest = new REST({ version: "10" })
    .setToken(process.env.DISCORD_TOKEN);

  try {
    await rest.put(
      Routes.applicationCommands(bot.user.id),
      {
        body: commands.map(c => c.toJSON())
      }
    );

    console.log("Comandos globales registrados correctamente.");
  } catch (error) {
    console.error("Error registrando comandos:", error);
  }
});

// PREFIJO DE IA: a!
client.on(Events.MessageCreate, async message => {
  if (message.author.bot || !message.guild) return;
  if (!message.content.toLowerCase().startsWith(PREFIX)) return;

  const question = message.content.slice(PREFIX.length).trim();

  if (!question) {
    return message.reply("💙 Escribe una pregunta después de `a!`.");
  }

  try {
    await message.channel.sendTyping();

    const answer = await askAI(
      question,
      message.guild.id,
      message.author.id
    );

    await message.reply({
      content: answer,
      allowedMentions: { parse: [] }
    });
  } catch (error) {
    console.error("Error de IA:", error.message);
    await message.reply(
      "⚠️ No pude conectar con la inteligencia artificial."
    );
  }
});

// COMANDOS SLASH
client.on(Events.InteractionCreate, async interaction => {
  if (!interaction.isChatInputCommand()) return;

  const guildId = interaction.guildId || "DM";
  const userId = interaction.user.id;

  try {
    if (interaction.commandName === "ayuda") {
      return interaction.reply({
        embeds: [helpEmbed()],
        ephemeral: true
      });
    }

    if (interaction.commandName === "ping") {
      return interaction.reply(
        `💙 ASTRIX AI está activo. Latencia: ${client.ws.ping} ms`
      );
    }

    if (interaction.commandName === "estado") {
      const uptime = Math.floor(client.uptime / 1000);
      return interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setColor(0x57F287)
            .setTitle("🟢 ASTRIX AI está activo")
            .setDescription("Todos los sistemas principales están iniciados.")
            .addFields(
              { name: "Latencia", value: `${client.ws.ping} ms`, inline: true },
              { name: "Tiempo activo", value: `${uptime} segundos`, inline: true },
              { name: "IA", value: "Configurada", inline: true }
            )
        ],
        ephemeral: true
      });
    }

    if (interaction.commandName === "servidor") {
      if (!interaction.guild) {
        return interaction.reply({
          content: "Este comando necesita un servidor.",
          ephemeral: true
        });
      }

      return interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setColor(0x5865F2)
            .setTitle(`🏠 ${interaction.guild.name}`)
            .addFields(
              { name: "Miembros", value: `${interaction.guild.memberCount}`, inline: true },
              { name: "ID", value: interaction.guild.id, inline: true }
            )
        ],
        ephemeral: true
      });
    }

    if (interaction.commandName === "usuario") {
      const user =
        interaction.options.getUser("miembro") || interaction.user;

      return interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setColor(0x5865F2)
            .setTitle("👤 Información del usuario")
            .setThumbnail(user.displayAvatarURL())
            .addFields(
              { name: "Nombre", value: user.username, inline: true },
              { name: "ID", value: user.id, inline: true },
              { name: "Bot", value: user.bot ? "Sí" : "No", inline: true }
            )
        ],
        ephemeral: true
      });
    }

    if (interaction.commandName === "decir") {
      if (!process.env.OWNER_ID ||
          userId !== process.env.OWNER_ID) {
        return interaction.reply({
          content: "⛔ No tienes permiso para usar este comando.",
          ephemeral: true
        });
      }

      return interaction.reply({
        content: interaction.options.getString("mensaje"),
        allowedMentions: { parse: [] }
      });
    }

    const key = memoryKey(guildId, userId);

    if (interaction.commandName === "memoria") {
      const count = (conversations.get(key) || []).length;

      return interaction.reply({
        content:
          `💾 **Tu memoria de conversación**\n` +
          `Mensajes de contexto: ${count}\n` +
          `La memoria es temporal y se reinicia cuando el bot se reinicia.`,
        ephemeral: true
      });
    }

    if (interaction.commandName === "olvidar") {
      conversations.delete(key);

      return interaction.reply({
        content: "🧹 Tu contexto de conversación ha sido borrado.",
        ephemeral: true
      });
    }

    let question = "";

    switch (interaction.commandName) {
      case "ia":
        question = interaction.options.getString("pregunta");
        break;

      case "explicar":
        question =
          "Explícame de forma sencilla y completa este tema: " +
          interaction.options.getString("tema");
        break;

      case "resumir":
        question =
          "Haz un resumen claro y ordenado de este texto: " +
          interaction.options.getString("texto");
        break;

      case "ideas":
        question =
          "Dame ideas creativas y originales sobre: " +
          interaction.options.getString("tema");
        break;

      case "codigo":
        question =
          "Ayúdame con programación. Explica y muestra ejemplos para: " +
          interaction.options.getString("problema");
        break;

      case "traducir":
        question =
          "Traduce el siguiente texto al idioma " +
          interaction.options.getString("idioma") +
          ": " + interaction.options.getString("texto");
        break;

      default:
        return;
    }

    await interaction.deferReply();

    const answer = await askAI(question, guildId, userId);

    return interaction.editReply({
      content: answer,
      allowedMentions: { parse: [] }
    });

  } catch (error) {
    console.error("Error en comando:", error);

    const response =
      "⚠️ Ocurrió un error al ejecutar ASTRIX AI.";

    if (interaction.deferred || interaction.replied) {
      return interaction.editReply(response);
    }

    return interaction.reply({
      content: response,
      ephemeral: true
    });
  }
});

client.login(process.env.DISCORD_TOKEN).catch(error => {
  console.error("Error iniciando ASTRIX AI:", error);
});
