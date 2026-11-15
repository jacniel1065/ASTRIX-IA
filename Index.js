
const {
  Client,
  GatewayIntentBits,
  REST,
  Routes,
  SlashCommandBuilder,
  Events,
  EmbedBuilder
} = require("discord.js");

const Groq = require("groq-sdk");

// CONFIGURACIÓN
const DISCORD_TOKEN = process.env.DISCORD_TOKEN;
const GROQ_API_KEY = process.env.GROQ_API_KEY;
const OWNER_ID = process.env.OWNER_ID;

const PREFIX = "a!";
const MODEL = "openai/gpt-oss-120b";

if (!DISCORD_TOKEN) throw new Error("Falta DISCORD_TOKEN");
if (!GROQ_API_KEY) throw new Error("Falta GROQ_API_KEY");

const groq = new Groq({ apiKey: GROQ_API_KEY });

// CLIENTE DISCORD
const bot = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

// MEMORIA TEMPORAL
const conversations = new Map();

// COMANDOS
const commands = [
  new SlashCommandBuilder()
    .setName("ayuda")
    .setDescription("Muestra todos los comandos"),

  new SlashCommandBuilder()
    .setName("ping")
    .setDescription("Comprueba la conexión"),

  new SlashCommandBuilder()
    .setName("ia")
    .setDescription("Conversa con ASTRIX AI")
    .addStringOption(o =>
      o.setName("pregunta")
        .setDescription("Tu pregunta")
        .setRequired(true)
    ),

  new SlashCommandBuilder()
    .setName("explicar")
    .setDescription("Explica un tema")
    .addStringOption(o =>
      o.setName("tema")
        .setDescription("Tema que quieres aprender")
        .setRequired(true)
    ),

  new SlashCommandBuilder()
    .setName("resumir")
    .setDescription("Resume un texto")
    .addStringOption(o =>
      o.setName("texto")
        .setDescription("Texto para resumir")
        .setRequired(true)
    ),

  new SlashCommandBuilder()
    .setName("ideas")
    .setDescription("Genera ideas")
    .addStringOption(o =>
      o.setName("tema")
        .setDescription("Tema de las ideas")
        .setRequired(true)
    ),

  new SlashCommandBuilder()
    .setName("codigo")
    .setDescription("Ayuda con programación")
    .addStringOption(o =>
      o.setName("problema")
        .setDescription("Tu problema")
        .setRequired(true)
    ),

  new SlashCommandBuilder()
    .setName("traducir")
    .setDescription("Traduce un texto")
    .addStringOption(o =>
      o.setName("texto")
        .setDescription("Texto para traducir")
        .setRequired(true)
    )
    .addStringOption(o =>
      o.setName("idioma")
        .setDescription("Idioma de destino")
        .setRequired(true)
    ),

  new SlashCommandBuilder()
    .setName("memoria")
    .setDescription("Consulta tu memoria"),

  new SlashCommandBuilder()
    .setName("olvidar")
    .setDescription("Borra tu memoria"),

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
        .setDescription("Usuario")
        .setRequired(false)
    ),

  new SlashCommandBuilder()
    .setName("decir")
    .setDescription("Enviar un mensaje")
    .addStringOption(o =>
      o.setName("mensaje")
        .setDescription("Mensaje")
        .setRequired(true)
    )
];

// FUNCIÓN DE INTELIGENCIA ARTIFICIAL
async function askAI(userId, guildId, question) {
  const key = `${guildId}:${userId}`;

  if (!conversations.has(key)) {
    conversations.set(key, []);
  }

  const history = conversations.get(key);

  const messages = [
    {
      role: "system",
      content:
        "Eres ASTRIX AI, un asistente inteligente de Discord. " +
        "Responde en español, de forma clara, útil y profesional."
    },
    ...history,
    {
      role: "user",
      content: question
    }
  ];

  const completion = await groq.chat.completions.create({
    model: MODEL,
    messages,
    temperature: 0.7,
    max_completion_tokens: 1500
  });

  const answer =
    completion.choices[0]?.message?.content ||
    "No pude generar una respuesta.";

  history.push(
    { role: "user", content: question },
    { role: "assistant", content: answer }
  );

  if (history.length > 10) {
    history.splice(0, history.length - 10);
  }

  return answer.slice(0, 1900);
}

// PANEL DE AYUDA
function createHelpEmbed() {
  return new EmbedBuilder()
    .setColor(0x5865F2)
    .setTitle("✦ ASTRIX AI | Centro de ayuda")
    .setDescription(
      "Tu asistente inteligente está listo para ayudarte."
    )
    .addFields(
      {
        name: "🤖 Inteligencia artificial",
        value:
          "`/ia` — Conversa con la IA\n" +
          "`/explicar` — Aprende un tema\n" +
          "`/resumir` — Resume textos"
      },
      {
        name: "🎨 Herramientas creativas",
        value:
          "`/ideas` — Genera ideas\n" +
          "`/codigo` — Ayuda con programación\n" +
          "`/traducir` — Traduce textos"
      },
      {
        name: "🧠 Memoria",
        value:
          "`/memoria` — Consulta tu memoria\n" +
          "`/olvidar` — Borra tu memoria"
      },
      {
        name: "⚙️ Sistema",
        value:
          "`/ping` — Latencia\n" +
          "`/estado` — Estado del bot\n" +
          "`/servidor` — Información del servidor\n" +
          "`/usuario` — Información de usuario\n" +
          "`/decir` — Enviar mensaje (propietario)"
      }
    )
    .setFooter({
      text: "ASTRIX AI • Inteligencia para tu comunidad"
    })
    .setTimestamp();
}

// CONEXIÓN
bot.once(Events.ClientReady, async client => {
  console.log(`ASTRIX AI conectado como ${client.user.tag}`);

  try {
    const rest = new REST({ version: "10" })
      .setToken(DISCORD_TOKEN);

    await rest.put(
      Routes.applicationCommands(client.user.id),
      {
        body: commands.map(c => c.toJSON())
      }
    );

    console.log("Comandos globales registrados correctamente.");
  } catch (error) {
    console.error("Error registrando comandos:", error.message);
  }
});

// PREFIJO a!
bot.on(Events.MessageCreate, async message => {
  if (message.author.bot || !message.guild) return;

  if (!message.content.toLowerCase().startsWith(PREFIX)) return;

  const question = message.content.slice(PREFIX.length).trim();

  if (!question) {
    return message.reply("💙 Escribe una pregunta después de `a!`.");
  }

  try {
    await message.channel.sendTyping();

    const answer = await askAI(
      message.author.id,
      message.guild.id,
      question
    );

    await message.reply(answer);
  } catch (error) {
    console.error("Error de Groq:", error.message);
    await message.reply(
      "⚠️ No pude conectar con la IA. Inténtalo nuevamente."
    );
  }
});

// COMANDOS SLASH
bot.on(Events.InteractionCreate, async interaction => {
  if (!interaction.isChatInputCommand()) return;

  const command = interaction.commandName;

  try {
    if (command === "ayuda") {
      return interaction.reply({
        embeds: [createHelpEmbed()],
        ephemeral: true
      });
    }

    if (command === "ping") {
      return interaction.reply(
        `🏓 Pong! ${bot.ws.ping} ms`
      );
    }

    if (command === "estado") {
      return interaction.reply({
        content:
          `🟢 ASTRIX AI está en línea.\n` +
          `Latencia: ${bot.ws.ping} ms\n` +
          `Activo: ${Math.floor(bot.uptime / 1000)} segundos`,
        ephemeral: true
      });
    }

    if (command === "servidor") {
      if (!interaction.guild) {
        return interaction.reply({
          content: "Este comando solo funciona en servidores.",
          ephemeral: true
        });
      }

      const guild = interaction.guild;

      const embed = new EmbedBuilder()
        .setColor(0x5865F2)
        .setTitle(`🏰 ${guild.name}`)
        .addFields(
          {
            name: "Miembros",
            value: `${guild.memberCount}`,
            inline: true
          },
          {
            name: "ID",
            value: guild.id,
            inline: true
          }
        );

      return interaction.reply({
        embeds: [embed],
        ephemeral: true
      });
    }

    if (command === "usuario") {
      const user =
        interaction.options.getUser("miembro") ||
        interaction.user;

      const embed = new EmbedBuilder()
        .setColor(0x5865F2)
        .setTitle(`👤 ${user.username}`)
        .setThumbnail(user.displayAvatarURL())
        .addFields({
          name: "ID",
          value: user.id
        });

      return interaction.reply({
        embeds: [embed],
        ephemeral: true
      });
    }

    if (command === "decir") {
      if (!OWNER_ID || interaction.user.id !== OWNER_ID) {
        return interaction.reply({
          content: "⛔ No tienes permiso.",
          ephemeral: true
        });
      }

      const text = interaction.options.getString("mensaje");

      await interaction.reply({
        content: "✅ Mensaje enviado.",
        ephemeral: true
      });

      return interaction.channel.send({
        content: text,
        allowedMentions: { parse: [] }
      });
    }

    if (command === "memoria") {
      const key = `${interaction.guildId || "dm"}:${interaction.user.id}`;
      const history = conversations.get(key) || [];

      return interaction.reply({
        content: `🧠 Tienes ${history.length} mensajes en tu memoria temporal.`,
        ephemeral: true
      });
    }

    if (command === "olvidar") {
      const key = `${interaction.guildId || "dm"}:${interaction.user.id}`;
      conversations.delete(key);

      return interaction.reply({
        content: "🧹 Tu memoria temporal ha sido borrada.",
        ephemeral: true
      });
    }

    let question = "";

    if (command === "ia") {
      question = interaction.options.getString("pregunta");
    }

    if (command === "explicar") {
      question =
        "Explícame este tema de forma sencilla: " +
        interaction.options.getString("tema");
    }

    if (command === "resumir") {
      question =
        "Resume este texto: " +
        interaction.options.getString("texto");
    }

    if (command === "ideas") {
      question =
        "Dame ideas originales sobre: " +
        interaction.options.getString("tema");
    }

    if (command === "codigo") {
      question =
        "Ayúdame con este problema de programación: " +
        interaction.options.getString("problema");
    }

    if (command === "traducir") {
      question =
        "Traduce este texto al idioma " +
        interaction.options.getString("idioma") +
        ": " +
        interaction.options.getString("texto");
    }

    if (question) {
      await interaction.deferReply();

      const answer = await askAI(
        interaction.user.id,
        interaction.guildId || "dm",
        question
      );

      return interaction.editReply(answer);
    }

  } catch (error) {
    console.error("Error en comando:", error.message);

    const message =
      "⚠️ Ocurrió un error al procesar tu solicitud.";

    if (interaction.deferred || interaction.replied) {
      await interaction.editReply(message).catch(() => {});
    } else {
      await interaction.reply({
        content: message,
        ephemeral: true
      }).catch(() => {});
    }
  }
});

// INICIAR BOT
bot.login(DISCORD_TOKEN).catch(error => {
  console.error("Error iniciando ASTRIX AI:", error.message);
});
