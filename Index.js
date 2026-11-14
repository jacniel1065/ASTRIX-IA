
const { Client, GatewayIntentBits, REST, Routes, SlashCommandBuilder } = require("discord.js");

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

const commands = [
  new SlashCommandBuilder()
    .setName("help")
    .setDescription("Muestra los comandos de ASTRIX IA"),

  new SlashCommandBuilder()
    .setName("say")
    .setDescription("Envía un mensaje como ASTRIX IA")
    .addStringOption(option =>
      option.setName("mensaje")
        .setDescription("Mensaje que quieres enviar")
        .setRequired(true)
    )
];

client.once("ready", () => {
  console.log(`ASTRIX IA está conectado como ${client.user.tag}`);
});

client.on("interactionCreate", async interaction => {
  if (!interaction.isChatInputCommand()) return;

  if (interaction.commandName === "help") {
    await interaction.reply({
      content: "🤖 **ASTRIX IA**\n\n/help — Ver comandos\n/say — Enviar un mensaje (solo propietario)",
      ephemeral: true
    });
  }

  if (interaction.commandName === "say") {
    const ownerId = process.env.OWNER_ID;

    if (!ownerId || interaction.user.id !== ownerId) {
      return interaction.reply({
        content: "⛔ Este comando es exclusivo del propietario.",
        ephemeral: true
      });
    }

    const mensaje = interaction.options.getString("mensaje", true);
    await interaction.reply({ content: mensaje });
  }
});

client.login(process.env.DISCORD_TOKEN);
