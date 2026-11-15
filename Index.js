
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
  intents: [GatewayIntentBits.Guilds]
});

if (!process.env.DISCORD_TOKEN) {
  console.error("Falta DISCORD_TOKEN.");
  process.exit(1);
}

if (!process.env.OPENAI_API_KEY) {
  console.error("Falta OPENAI_API_KEY.");
  process.exit(1);
}

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

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

client.on(Events.InteractionCreate, async interaction => {
  if (!interaction.isChatInputCommand()) return;

  try {
    if (interaction.commandName === "ayuda") {
      return interaction.reply({
        content:
          "🤖 **ASTRIX AI — Centro de ayuda**\n\n" +
          " `/ayuda` — Ver comandos.\n" +
          "`/ping` — Comprobar funcionamiento.\n" +
          "`/decir` — Enviar mensajes.\n" +
          "`/ia` — Conversar con IA.\n" +
          "`/servidor` — Información del servidor.\n" +
          "`/usuario` — Información de usuarios.\n" +
          "`/traducir` — Traducir textos.",
        ephemeral: true
      });
    }

    if (interaction.commandName === "ping") {
      return interaction.reply(
        `💙 ¡ASTRIX AI está funcionando! Latencia: ${client.ws.ping} ms`
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
          `👥 Miembros aproximados: ${interaction.guild.memberCount}\n` +
          `🆔 ID: ${interaction.guild.id}`,
        ephemeral: true
      });
    }

    if (interaction.commandName === "usuario") {
      const usuario =
        interaction.options.getUser("miembro") || interaction.user;

      return interaction.reply({
        content:
          `👤 **Usuario:** ${usuario.username}\n` +
          `🆔 **ID:** ${usuario.id}\n` +
          `🤖 **Bot:** ${usuario.bot ? "Sí" : "No"}`,
        ephemeral: true
      });
    }

    if (
      interaction.commandName === "ia" ||
      interaction.commandName === "traducir"
    ) {
      const texto = interaction.commandName === "ia"
        ? interaction.options.getString("pregunta")
        : `Traduce este texto al español. Si ya está en español, tradúcelo al inglés:\n${interaction.options.getString("texto")}`;

      await interaction.deferReply();

      const response = await openai.responses.create({
        model: "gpt-4.1-mini",
        instructions:
          "Eres ASTRIX AI, un asistente útil, amable y claro. Responde en español.",
        input: texto
      });

      return interaction.editReply({
        content: (
          response.output_text || "No pude generar una respuesta."
        ).slice(0, 1900),
        allowedMentions: { parse: [] }
      });
    }

  } catch (error) {
    console.error("Error en comando:", error);

    const mensaje = "⚠️ Ocurrió un error al ejecutar el comando.";

    if (interaction.deferred || interaction.replied) {
      return interaction.editReply(mensaje);
    }

    return interaction.reply({
      content: mensaje,
      ephemeral: true
    });
  }
});

client.login(process.env.DISCORD_TOKEN).catch(error => {
  console.error("No se pudo iniciar ASTRIX AI:", error);
});
