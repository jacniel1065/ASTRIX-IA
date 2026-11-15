
const {
  Client,
  GatewayIntentBits,
  REST,
  Routes,
  SlashCommandBuilder,
  Events
} = require("discord.js");

const OpenAI = require("openai");

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

if (!process.env.DISCORD_TOKEN || !process.env.OPENAI_API_KEY) {
  console.error("Faltan variables privadas.");
  process.exit(1);
}

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

const PREFIX = "a!";

const commands = [
  new SlashCommandBuilder()
    .setName("ayuda")
    .setDescription("Muestra los comandos de ASTRIX AI"),

  new SlashCommandBuilder()
    .setName("ping")
    .setDescription("Comprueba si ASTRIX AI funciona"),

  new SlashCommandBuilder()
    .setName("decir")
    .setDescription("Envía un mensaje como el bot")
    .addStringOption(option =>
      option.setName("mensaje")
        .setDescription("Mensaje que quieres enviar")
        .setRequired(true)
    ),

  new SlashCommandBuilder()
    .setName("ia")
    .setDescription("Habla con la inteligencia artificial")
    .addStringOption(option =>
      option.setName("pregunta")
        .setDescription("Escribe tu pregunta")
        .setRequired(true)
        .setMaxLength(1000)
    ),

  new SlashCommandBuilder()
    .setName("servidor")
    .setDescription("Muestra información del servidor"),

  new SlashCommandBuilder()
    .setName("usuario")
    .setDescription("Muestra información de un usuario")
    .addUserOption(option =>
      option.setName("miembro")
        .setDescription("Usuario que quieres consultar")
        .setRequired(false)
    ),

  new SlashCommandBuilder()
    .setName("traducir")
    .setDescription("Traduce un texto con IA")
    .addStringOption(option =>
      option.setName("texto")
        .setDescription("Texto que quieres traducir")
        .setRequired(true)
        .setMaxLength(1000)
    )
];

async function askAI(question) {
  const response = await openai.responses.create({
    model: "gpt-4.1-mini",
    instructions:
      "Eres ASTRIX AI, un asistente útil, amable y claro. Responde en español.",
    input: question
  });

  return (
    response.output_text || "No pude generar una respuesta."
  ).slice(0, 1900);
}

client.once(Events.ClientReady, async bot => {
  console.log(`ASTRIX AI conectado como ${bot.user.tag}`);

  const rest = new REST({ version: "10" })
    .setToken(process.env.DISCORD_TOKEN);

  try {
    await rest.put(
      Routes.applicationCommands(bot.user.id),
      {
        body: commands.map(command => command.toJSON())
      }
    );

    console.log("Comandos globales registrados correctamente.");
  } catch (error) {
    console.error("Error registrando comandos:", error);
  }
});

// PREFIJO a!
client.on(Events.MessageCreate, async message => {
  if (message.author.bot || !message.guild) return;

  if (!message.content.toLowerCase().startsWith(PREFIX)) return;

  const question = message.content.slice(PREFIX.length).trim();

  if (!question) {
    return message.reply("💙 Escribe una pregunta después de `a!`.");
  }

  try {
    await message.channel.sendTyping();

    const answer = await askAI(question);

    await message.reply({
      content: answer,
      allowedMentions: { parse: [] }
    });
  } catch (error) {
    console.error("Error en prefijo IA:", error.message);
    await message.reply("⚠️ No pude conectar con la inteligencia artificial.");
  }
});

// COMANDOS SLASH
client.on(Events.InteractionCreate, async interaction => {
  if (!interaction.isChatInputCommand()) return;

  try {
    if (interaction.commandName === "ayuda") {
      return interaction.reply({
        content:
          "🤖 **ASTRIX AI — Ayuda**\n\n" +
          "`a! pregunta` — Hablar con la IA.\n" +
          "`/ayuda` — Ver comandos.\n" +
          "`/ping` — Comprobar funcionamiento.\n" +
          "`/decir` — Enviar mensajes.\n" +
          "`/ia` — Hablar con la IA.\n" +
          "`/servidor` — Información del servidor.\n" +
          "`/usuario` — Información de usuarios.\n" +
          "`/traducir` — Traducir textos.",
        ephemeral: true
      });
    }

    if (interaction.commandName === "ping") {
      return interaction.reply(
        `💙 ASTRIX AI está funcionando. Latencia: ${client.ws.ping} ms`
      );
    }

    if (interaction.commandName === "decir") {
      if (interaction.user.id !== process.env.OWNER_ID) {
        return interaction.reply({
          content: "⛔ No tienes permiso para usar este comando.",
          ephemeral: true
        });
      }

      const mensaje = interaction.options.getString("mensaje");

      return interaction.reply({
        content: mensaje,
        allowedMentions: { parse: [] }
      });
    }

    if (interaction.commandName === "servidor") {
      return interaction.reply({
        content:
          `🏠 **${interaction.guild.name}**\n` +
          `👥 Miembros: ${interaction.guild.memberCount}\n` +
          `🆔 ID: ${interaction.guild.id}`,
        ephemeral: true
      });
    }

    if (interaction.commandName === "usuario") {
      const user =
        interaction.options.getUser("miembro") || interaction.user;

      return interaction.reply({
        content:
          `👤 Usuario: ${user.username}\n` +
          `🆔 ID: ${user.id}\n` +
          `🤖 Bot: ${user.bot ? "Sí" : "No"}`,
        ephemeral: true
      });
    }

    if (
      interaction.commandName === "ia" ||
      interaction.commandName === "traducir"
    ) {
      const text = interaction.commandName === "ia"
        ? interaction.options.getString("pregunta")
        : `Traduce este texto al español. Si ya está en español, tradúcelo al inglés:\n${interaction.options.getString("texto")}`;

      await interaction.deferReply();

      const answer = await askAI(text);

      return interaction.editReply({
        content: answer,
        allowedMentions: { parse: [] }
      });
    }

  } catch (error) {
    console.error("Error en comando:", error);

    const response = "⚠️ Ocurrió un error al ejecutar el comando.";

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

