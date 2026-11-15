const {
  Client,
  GatewayIntentBits,
  REST,
  Routes,
  SlashCommandBuilder,
  Events
} = require("discord.js");

const client = new Client({
  intents: [GatewayIntentBits.Guilds]
});

// Comandos de ASTRIX-IA
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
    )
];

client.once(Events.ClientReady, async (bot) => {
  console.log(`ASTRIX-IA conectado como ${bot.user.tag}`);

  const rest = new REST({ version: "10" })
    .setToken(process.env.DISCORD_TOKEN);

  try {
    await rest.put(
      Routes.applicationCommands(bot.user.id),
      bot.user.id
      "1560881176166535171"
    ),
      { body: commands.map(command => command.toJSON()) }
    );

    console.log("Comandos registrados correctamente.");
  } catch (error) {
    console.error("Error registrando comandos:", error);
  }
});

// Respuestas a los comandos
client.on(Events.InteractionCreate, async interaction => {
  if (!interaction.isChatInputCommand()) return;

  if (interaction.commandName === "ayuda") {
    await interaction.reply({
      content:
        "🤖 **ASTRIX-IA — Sistema de ayuda**\n\n" +
        " `/ayuda` — Ver los comandos.\n" +
        " `/ping` — Comprobar el funcionamiento.\n" +
        " `/decir` — Enviar un mensaje como el bot.",
      ephemeral: true
    });
  }

  if (interaction.commandName === "ping") {
    await interaction.reply("💙 ¡ASTRIX-IA está funcionando!");
  }

  if (interaction.commandName === "decir") {
    if (interaction.user.id !== process.env.OWNER_ID) {
      return interaction.reply({
        content: "⛔ No tienes permiso para usar este comando.",
        ephemeral: true
      });
    }

    const mensaje = interaction.options.getString("mensaje");

    await interaction.reply({
      content: mensaje,
      allowedMentions: { parse: [] }
    });
  }
});

// Inicio del bot
if (!process.env.DISCORD_TOKEN) {
  console.error("Falta configurar DISCORD_TOKEN.");
  process.exit(1);
}

client.login(process.env.DISCORD_TOKEN).catch(error => {
  console.error("No se pudo iniciar ASTRIX-IA:", error);
});
