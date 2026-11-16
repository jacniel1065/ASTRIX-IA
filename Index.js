const {
  Client,
  GatewayIntentBits,
  SlashCommandBuilder,
  REST,
  Routes,
  EmbedBuilder,
  AttachmentBuilder
} = require("discord.js");

const Groq = require("groq-sdk");

const client = new Client({
  intents: [GatewayIntentBits.Guilds]
});

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY
});

const MODEL = "openai/gpt-oss-120b";
const conversations = new Map();

const commands = [
  new SlashCommandBuilder()
    .setName("ayuda")
    .setDescription("Muestra los comandos de ASTRIX AI"),

  new SlashCommandBuilder()
    .setName("ping")
    .setDescription("Comprueba la conexión"),

  new SlashCommandBuilder()
    .setName("ia")
    .setDescription("Habla con ASTRIX AI")
    .addStringOption(o =>
      o.setName("mensaje").setDescription("Tu mensaje").setRequired(true)
    ),

  new SlashCommandBuilder()
    .setName("explicar")
    .setDescription("Explica cualquier tema")
    .addStringOption(o =>
      o.setName("tema").setDescription("Tema").setRequired(true)
    ),

  new SlashCommandBuilder()
    .setName("resumir")
    .setDescription("Resume un texto")
    .addStringOption(o =>
      o.setName("texto").setDescription("Texto").setRequired(true)
    ),

  new SlashCommandBuilder()
    .setName("ideas")
    .setDescription("Genera ideas")
    .addStringOption(o =>
      o.setName("tema").setDescription("Tema").setRequired(true)
    ),

  new SlashCommandBuilder()
    .setName("codigo")
    .setDescription("Ayuda con programación")
    .addStringOption(o =>
      o.setName("problema").setDescription("Problema").setRequired(true)
    ),

  new SlashCommandBuilder()
    .setName("traducir")
    .setDescription("Traduce textos")
    .addStringOption(o =>
      o.setName("texto").setDescription("Texto").setRequired(true)
    )
    .addStringOption(o =>
      o.setName("idioma").setDescription("Idioma").setRequired(true)
    ),

  new SlashCommandBuilder()
    .setName("memoria")
    .setDescription("Información sobre la memoria"),

  new SlashCommandBuilder()
    .setName("olvidar")
    .setDescription("Borra tu conversación"),

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
      o.setName("persona").setDescription("Usuario")
    ),

  new SlashCommandBuilder()
    .setName("decir")
    .setDescription("Envía un mensaje")
    .addStringOption(o =>
      o.setName("mensaje").setDescription("Mensaje").setRequired(true)
    ),

  new SlashCommandBuilder()
    .setName("imagen")
    .setDescription("Genera imágenes con IA")
    .addStringOption(o =>
      o.setName("descripcion")
        .setDescription("Describe la imagen que deseas")
        .setRequired(true)
    )
].map(c => c.toJSON());

async function askAI(userId, guildId, prompt) {
  const key = `${guildId || "dm"}-${userId}`;

  if (!conversations.has(key)) {
    conversations.set(key, []);
  }

  const history = conversations.get(key);
  history.push({ role: "user", content: prompt });

  const result = await groq.chat.completions.create({
    model: MODEL,
    messages: [
      {
        role: "system",
        content: "Eres ASTRIX AI, un asistente inteligente, amable y útil. Responde en español."
      },
      ...history
    ],
    temperature: 0.7,
    max_completion_tokens: 1500
  });

  const answer =
    result.choices[0].message.content || "No pude responder.";

  history.push({ role: "assistant", content: answer });

  if (history.length > 10) {
    history.splice(0, history.length - 10);
  }

  return answer;
}

client.once("ready", async () => {
  console.log(`ASTRIX AI conectado como ${client.user.tag}`);

  const rest = new REST({ version: "10" })
    .setToken(process.env.DISCORD_TOKEN);

  try {
    await rest.put(
      Routes.applicationCommands(client.user.id),
      { body: commands }
    );
    console.log("Comandos registrados correctamente.");
  } catch (error) {
    console.error("Error registrando comandos:", error);
  }
});

client.on("interactionCreate", async interaction => {
  if (!interaction.isChatInputCommand()) return;

  const name = interaction.commandName;

  try {
    if (name === "ping") {
      return interaction.reply(`🏓 Pong: ${client.ws.ping} ms`);
    }

    if (name === "ayuda") {
      const embed = new EmbedBuilder()
        .setColor(0x5865F2)
        .setTitle("✦ ASTRIX AI")
        .setDescription("Tu asistente inteligente.")
        .addFields(
          {
            name: "🤖 Inteligencia artificial",
            value: "`/ia` `/explicar` `/resumir` `/ideas` `/codigo` `/traducir`"
          },
          { name: "🖼️ Imágenes", value: "`/imagen`" },
          { name: "⚙️ Utilidades", value: "`/ping` `/estado` `/servidor` `/usuario`" },
          { name: "🧠 Memoria", value: "`/memoria` `/olvidar`" },
          { name: "👑 Otros", value: "`/decir`" }
        )
        .setFooter({ text: "ASTRIX AI • Inteligencia artificial" });

      return interaction.reply({ embeds: [embed] });
    }

    if (name === "estado") {
      return interaction.reply({
        content: `🟢 ASTRIX AI está activo. Latencia: ${client.ws.ping} ms`,
        ephemeral: true
      });
    }

    if (name === "servidor") {
      if (!interaction.guild) {
        return interaction.reply({
          content: "Este comando solo funciona en servidores.",
          ephemeral: true
        });
      }

      const embed = new EmbedBuilder()
        .setColor(0x5865F2)
        .setTitle(interaction.guild.name)
        .addFields({
          name: "Miembros",
          value: `${interaction.guild.memberCount}`
        });

      return interaction.reply({ embeds: [embed] });
    }

    if (name === "usuario") {
      const user =
        interaction.options.getUser("persona") || interaction.user;

      const embed = new EmbedBuilder()
        .setColor(0x5865F2)
        .setTitle(user.username)
        .setThumbnail(user.displayAvatarURL())
        .addFields(
          { name: "Usuario", value: user.tag },
          { name: "ID", value: user.id }
        );

      return interaction.reply({ embeds: [embed] });
    }

    if (name === "olvidar") {
      conversations.delete(
        `${interaction.guildId || "dm"}-${interaction.user.id}`
      );

      return interaction.reply({
        content: "🧠 Tu conversación ha sido borrada.",
        ephemeral: true
      });
    }

    if (name === "memoria") {
      return interaction.reply({
        content: "🧠 ASTRIX AI conserva hasta 10 mensajes de tu conversación mientras permanece encendido.",
        ephemeral: true
      });
    }

    if (name === "decir") {
      if (
        !process.env.OWNER_ID ||
        interaction.user.id !== process.env.OWNER_ID
      ) {
        return interaction.reply({
          content: "⛔ No tienes permiso para usar este comando.",
          ephemeral: true
        });
      }

      const mensaje = interaction.options.getString("mensaje");

      await interaction.reply({
        content: "✅ Mensaje enviado.",
        ephemeral: true
      });

      return interaction.channel.send(mensaje);
    }

    if (name === "imagen") {
      await interaction.deferReply();

      const prompt = interaction.options.getString("descripcion");

      if (!process.env.POLLINATIONS_API_KEY) {
        return interaction.editReply(
          "❌ Falta configurar POLLINATIONS_API_KEY en Lunafy."
        );
      }

      const url =
        "https://gen.pollinations.ai/image/" +
        encodeURIComponent(prompt) +
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

      const imageBuffer = Buffer.from(await response.arrayBuffer());

      if (!imageBuffer.length) {
        throw new Error("La imagen recibida está vacía.");
      }

      const image = new AttachmentBuilder(imageBuffer, {
        name: "astrix-imagen.png"
      });

      const embed = new EmbedBuilder()
        .setColor(0x5865F2)
        .setTitle("🖼️ ASTRIX AI | Imagen generada")
        .setDescription(`**Descripción:** ${prompt}`)
        .setImage("attachment://astrix-imagen.png")
        .setFooter({ text: "Creado con ASTRIX AI" });

      return interaction.editReply({
        embeds: [embed],
        files: [image]
      });
    }

    const options = {
      ia: ["mensaje", null],
      explicar: ["tema", "Explica de forma sencilla: "],
      resumir: ["texto", "Resume este texto: "],
      ideas: ["tema", "Dame ideas sobre: "],
      codigo: ["problema", "Ayúdame con este problema de programación: "],
      traducir: ["texto", "Traduce al idioma "]
    };

    if (options[name]) {
      const [field, prefix] = options[name];
      const value = interaction.options.getString(field);

      let prompt;

      if (name === "traducir") {
        const idioma = interaction.options.getString("idioma");
        prompt = `Traduce al idioma ${idioma}: ${value}`;
      } else {
        prompt = prefix ? prefix + value : value;
      }

      await interaction.deferReply();

      const answer = await askAI(
        interaction.user.id,
        interaction.guildId,
        prompt
      );

      return interaction.editReply(answer.slice(0, 2000));
    }

  } catch (error) {
    console.error("Error en comando:", error);

    const message = "❌ Ocurrió un error. Inténtalo de nuevo más tarde.";

    if (interaction.deferred || interaction.replied) {
      return interaction.editReply(message).catch(() => {});
    }

    return interaction.reply({
      content: message,
      ephemeral: true
    }).catch(() => {});
  }
});

client.login(process.env.DISCORD_TOKEN);
