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

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

const commands = [
  new SlashCommandBuilder()
    .setName("ayuda")
    .setDescription("Muestra los comandos de ASTRIX-IA"),

  new SlashCommandBuilder()
    .setName("ping")
    .setDescription("Comprueba si ASTRIX-IA está funcionando"),

  new SlashCommandBuilder()
    .setName("decir")
    .setDescription("Envía un mensaje como el bot")
    .addStringOption(option =>
      option
        .setName("mensaje")
        .setDescription("Mensaje que quieres enviar")
        .setRequired(true)
    ),

  new SlashCommandBuilder()
    .setName("ia")
    .setDescription("Habla con la inteligencia artificial")
    .addStringOption(option =>
      option
        .setName("pregunta")
        .setDescription("Escribe tu pregunta")
        .setRequired(true)
        .setMaxLength(1000)
    )
];

client.once(Events.ClientReady, async bot => {
  console.log(`ASTRIX-IA conectado como ${bot.user.tag}`);

  const rest = new REST({ version: "10" })
    .setToken(process.env.DISCORD_TOKEN);

  try {
    await rest.put(
      Routes.applicationGuildCommands(
        bot.user.id,
        "1560881176166535171"
      ),
      {
        body: commands.map(command => command.toJSON())
      }
    );

    console.log("Comandos registrados correctamente.");
  } catch (error) {
    console.error("Error registrando comandos:", error);
  }
});

client.on(Events.InteractionCreate, async interaction => {
  if (!interaction.isChatInputCommand()) return;

  if (interaction.commandName === "ayuda") {
    return interaction.reply({
      content:
        "🤖 **ASTRIX-IA — Sistema de ayuda**\n\n" +
        "/ayuda — Ver los comandos.\n" +
        "/ping — Comprobar el funcionamiento.\n" +
        "/decir — Enviar un mensaje como el bot.\n" +
        "/ia — Hablar con la inteligencia artificial.",
      ephemeral: true
    });
  }

  if (interaction.commandName === "ping") {
    return interaction.reply("💙 ¡ASTRIX-IA está funcionando!");
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

  if (interaction.commandName === "ia") {
    const pregunta = interaction.options.getString("pregunta");

    await interaction.deferReply();

    try {
      const response = await openai.responses.create({
        model: "gpt-4.1-mini",
        instructions:
          "Eres ASTRIX AI, un asistente útil, amable y claro. Responde en español.",
        input: pregunta
      });

      const respuesta =
        response.output_text || "No pude generar una respuesta.";

      return interaction.editReply({
        content: respuesta.slice(0, 1900),
        allowedMentions: { parse: [] }
      });

    } catch (error) {
      console.error("Error de IA:", error.message);

      return interaction.editReply(
        "⚠️ No pude conectar con la inteligencia artificial. Inténtalo más tarde."
      );
    }
  }
});

if (!process.env.DISCORD_TOKEN) {
  console.error("Falta configurar DISCORD_TOKEN.");
  process.exit(1);
}

if (!process.env.OPENAI_API_KEY) {
  console.error("Falta configurar OPENAI_API_KEY.");
  process.exit(1);
}

client.login(process.env.DISCORD_TOKEN).catch(error => {
  console.error("No se pudo iniciar ASTRIX-IA:", error);
});
