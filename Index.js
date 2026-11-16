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

// ==========================================
// ADER-AI | CONFIGURACIÓN PRINCIPAL
// ==========================================

const BOT_NAME = "ADER-AI";
const COMMUNITY_NAME = "ADER WORLD";
const OWNER_ID = process.env.OWNER_ID;

const MODEL = "openai/gpt-oss-120b";
const SESSION_TIMEOUT = 60 * 1000;
const MAX_HISTORY = 10;

if (!process.env.DISCORD_TOKEN) {
  throw new Error("Falta DISCORD_TOKEN");
}

if (!process.env.GROQ_API_KEY) {
  throw new Error("Falta GROQ_API_KEY");
}

// ==========================================
// CONEXIÓN DISCORD
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

// ==========================================
// SISTEMA DE SESIONES
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
    queue: Promise.resolve()
  };

  sessions.set(key, session);
  touchSession(key, session);

  console.log(`🟢 Nueva sesión: ${key}`);

  return { key, session };
}

function closeSession(key) {
  const session = sessions.get(key);

  if (session) {
    clearTimeout(session.timer);
    sessions.delete(key);
  }

  histories.delete(key);

  console.log(`🧹 Sesión eliminada: ${key}`);
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
            `Eres ${BOT_NAME}, el asistente oficial de ` +
            `${COMMUNITY_NAME}. Responde en español cuando ` +
            "el usuario escriba en español. Sé claro, útil, " +
            "amable y respetuoso. Mantén el contexto."
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
// RESPUESTAS DE COMANDOS
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

// ==========================================
// RESPUESTAS A MENSAJES NORMALES
// ==========================================

async function answerSessionMessage(message, key, session) {
  try {
    console.log(`🧠 ADER-AI procesando: ${message.content}`);

    const answer = await askAI(key, message.content.trim());

    if (sessions.get(key) !== session) {
      console.log("La sesión ya no está activa.");
      return;
    }

    stats.ia++;

    await message.channel.send({
      embeds: [createAIEmbed(answer)]
    });

    console.log("✅ ADER-AI respondió correctamente.");

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
// COMANDOS SLASH
// ==========================================

const commands = [

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
    .setDescription("Borra tu contexto y cierra tu conversación"),

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
// INICIO DEL BOT
// ==========================================

client.once("ready", async () => {
  console.log(`🤖 ${BOT_NAME} está conectado.`);
  console.log(`Conectado como ${client.user.tag}`);
  console.log("📩 Sistema de mensajes normales preparado.");

  try {
    const rest = new REST({ version: "10" })
      .setToken(process.env.DISCORD_TOKEN);

    await rest.put(
      Routes.applicationCommands(client.user.id),
      { body: commands }
    );

    console.log("✅ Comandos de ADER-AI registrados.");
  } catch (error) {
    console.error("Error registrando comandos:", error);
  }
});

// ==========================================
// DIAGNÓSTICO Y CONVERSACIONES AUTOMÁTICAS
// ==========================================

client.on("messageCreate", async message => {

  // DIAGNÓSTICO: muestra todos los mensajes recibidos.
  console.log(
    "📩 MENSAJE RECIBIDO:",
    message.author.username,
    "| Contenido:",
    message.content,
    "| Canal:",
    message.channelId
  );

  if (message.author.bot) {
    console.log("Ignorado: mensaje de un bot.");
    return;
  }

  if (!message.guild) {
    console.log("Ignorado: mensaje privado.");
    return;
  }

  const content = message.content.trim();

  if (!content) {
    console.log("Ignorado: mensaje sin contenido de texto.");
    return;
  }

  const key = getHistoryKey(message);
  const session = sessions.get(key);

  if (!session) {
    console.log("⚪ Mensaje recibido, pero no hay sesión activa:", key);
    return;
  }

  if (Date.now() - session.lastActivity >= SESSION_TIMEOUT) {
    console.log("⏱️ Sesión vencida.");
    await expireSession(key, session);
    return;
  }

  console.log("🟢 Sesión activa detectada:", key);

  // Reiniciar el minuto de inactividad.
  touchSession(key, session);

  // Procesar mensajes en orden.
  session.queue = session.queue
    .then(async () => {
      if (sessions.get(key) !== session) return;

      await answerSessionMessage(message, key, session);
    })
    .catch(error => {
      console.error("Error en cola de conversación:", error);
    });
});

// ==========================================
// INTERACCIONES
// ==========================================

client.on("interactionCreate", async interaction => {
  if (!interaction.isChatInputCommand()) return;

  const name = interaction.commandName;

  stats.total++;

  try {

    // AYUDA
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
            value: "`/ping` `/estado` `/servidor` `/usuario`"
          },
          {
            name: "💬 Conversaciones",
            value: "Usa `/ia` una vez y continúa escribiendo mensajes normales. La sesión finaliza tras 60 segundos de inactividad."
          }
        )
        .setThumbnail(client.user.displayAvatarURL())
        .setFooter({
          text: `${COMMUNITY_NAME} • ${BOT_NAME}`
        });

      return interaction.reply({ embeds: [embed] });
    }

    // PING
    if (name === "ping") {
      const embed = new EmbedBuilder()
        .setColor(0x2ECC71)
        .setTitle("🏓 ADER-AI | CONEXIÓN")
        .addFields({
          name: "Latencia",
          value: `${client.ws.ping} ms`,
          inline: true
        })
        .setFooter({
          text: `${COMMUNITY_NAME} • ${BOT_NAME}`
        });

      return interaction.reply({ embeds: [embed] });
    }

    // ESTADO
    if (name === "estado") {
      const embed = new EmbedBuilder()
        .setColor(0x3498DB)
        .setTitle("📊 ADER-AI • SYSTEM MONITOR")
        .setThumbnail(client.user.displayAvatarURL())
        .addFields(
          {
            name: "🟢 Estado",
            value: "En línea",
            inline: true
          },
          {
            name: "🏓 Latencia",
            value: `${client.ws.ping} ms`,
            inline: true
          },
          {
            name: "⏱️ Tiempo activo",
            value: formatUptime(Date.now() - stats.startedAt),
            inline: true
          },
          {
            name: "📈 Comandos utilizados",
            value: `${stats.total}`,
            inline: true
          },
          {
            name: "🧠 Consultas de IA",
            value: `${stats.ia}`,
            inline: true
          },
          {
            name: "🎨 Imágenes solicitadas",
            value: `${stats.imagenes}`,
            inline: true
          },
          {
            name: "🌎 Servidores",
            value: `${client.guilds.cache.size}`,
            inline: true
          },
          {
            name: "👥 Usuarios en caché",
            value: `${client.users.cache.size}`,
            inline: true
          },
          {
            name: "💬 Sesiones activas",
            value: `${sessions.size}`,
            inline: true
          }
        )
        .setFooter({
          text: `${COMMUNITY_NAME} • ${BOT_NAME} SYSTEM`
        })
        .setTimestamp();

      return interaction.reply({ embeds: [embed] });
    }

    // IA
    if (name === "ia") {
      startSession(interaction);

      const prompt = interaction.options.getString("pregunta");

      if (prompt) {
        return replyAI(interaction, prompt);
      }

      const embed = new EmbedBuilder()
        .setColor(0x3498DB)
        .setTitle("💬 Conversación iniciada")
        .setDescription(
          `¡Hola, ${interaction.user.username}!\n\n` +
          "Ya puedes conversar conmigo escribiendo mensajes normales. " +
          "No necesitas volver a utilizar `/ia`.\n\n" +
          "⏱️ La conversación finalizará después de 60 segundos sin actividad."
        )
        .setFooter({
          text: `${COMMUNITY_NAME} • ${BOT_NAME}`
        });

      return interaction.reply({ embeds: [embed] });
    }

    // EXPLICAR
    if (name === "explicar") {
      const tema = interaction.options.getString("tema");

      return replyAI(
        interaction,
        `Explícame de manera clara y sencilla: ${tema}`
      );
    }

    // RESUMIR
    if (name === "resumir") {
      const texto = interaction.options.getString("texto");

      return replyAI(
        interaction,
        `Resume el siguiente texto de forma clara: ${texto}`
      );
    }

    // IDEAS
    if (name === "ideas") {
      const tema = interaction.options.getString("tema");

      return replyAI(
        interaction,
        `Dame ideas creativas sobre: ${tema}`
      );
    }

    // CODIGO
    if (name === "codigo") {
      const consulta = interaction.options.getString("consulta");

      return replyAI(
        interaction,
        `Ayúdame con esta consulta de programación: ${consulta}`
      );
    }

    // TRADUCIR
    if (name === "traducir") {
      const texto = interaction.options.getString("texto");
      const idioma = interaction.options.getString("idioma");

      return replyAI(
        interaction,
        `Traduce al idioma ${idioma} este texto: ${texto}`
      );
    }

    // MEMORIA
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
        .setFooter({
          text: `${COMMUNITY_NAME} • ${BOT_NAME}`
        });

      return interaction.reply({
        embeds: [embed],
        ephemeral: true
      });
    }

    // OLVIDAR
    if (name === "olvidar") {
      const key = getHistoryKey(interaction);

      closeSession(key);

      return interaction.reply({
        content: "🧹 Tu contexto ha sido borrado y tu conversación ha sido cerrada.",
        ephemeral: true
      });
    }

    // IMAGEN
    if (name === "imagen") {
      await interaction.deferReply();

      const prompt = interaction.options.getString("descripcion");

      if (!process.env.POLLINATIONS_API_KEY) {
        return interaction.editReply(
          "❌ Falta configurar POLLINATIONS_API_KEY."
        );
      }

      try {
        const url =
          "https://gen.pollinations.ai/image/" +
          encodeURIComponent(prompt) +
          "?model=flux&width=1024&height=1024&nologo=true";

        const response = await fetch(url, {
          headers: {
            Authorization:
              `Bearer ${process.env.POLLINATIONS_API_KEY}`
          },
          signal: AbortSignal.timeout(120000)
        });

        if (!response.ok) {
          throw new Error(
            `Pollinations respondió con código ${response.status}`
          );
        }

        const buffer = Buffer.from(
          await response.arrayBuffer()
        );

        const image = new AttachmentBuilder(buffer, {
          name: "ader-ai-imagen.png"
        });

        const embed = new EmbedBuilder()
          .setColor(0x3498DB)
          .setTitle("🎨 ADER-AI | IMAGEN GENERADA")
          .setDescription(`**Descripción:** ${prompt}`)
          .setImage("attachment://ader-ai-imagen.png")
          .setFooter({
            text: `Creado con ${BOT_NAME} • ${COMMUNITY_NAME}`
          });

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

    // SERVIDOR
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
          {
            name: "Nombre",
            value: guild.name,
            inline: true
          },
          {
            name: "Miembros",
            value: `${guild.memberCount}`,
            inline: true
          },
          {
            name: "Canales",
            value: `${guild.channels.cache.size}`,
            inline: true
          }
        )
        .setFooter({
          text: `${COMMUNITY_NAME} • ${BOT_NAME}`
        });

      return interaction.reply({ embeds: [embed] });
    }

    // USUARIO
    if (name === "usuario") {
      const user =
        interaction.options.getUser("miembro") ||
        interaction.user;

      const embed = new EmbedBuilder()
        .setColor(0x3498DB)
        .setTitle("👤 ADER-AI | INFORMACIÓN DEL USUARIO")
        .setThumbnail(user.displayAvatarURL())
        .addFields(
          {
            name: "Usuario",
            value: user.username,
            inline: true
          },
          {
            name: "ID",
            value: user.id,
            inline: true
          },
          {
            name: "Cuenta creada",
            value:
              `<t:${Math.floor(user.createdTimestamp / 1000)}:D>`,
            inline: true
          }
        )
        .setFooter({
          text: `${COMMUNITY_NAME} • ${BOT_NAME}`
        });

      return interaction.reply({ embeds: [embed] });
    }

    // DECIR
    if (name === "decir") {
      if (!OWNER_ID || interaction.user.id !== OWNER_ID) {
        return interaction.reply({
          content:
            "🔒 Este comando está reservado al propietario de ADER-AI.",
          ephemeral: true
        });
      }

      const mensaje = interaction.options.getString("mensaje");

      return interaction.reply({
        content: mensaje,
        allowedMentions: {
          parse: []
        }
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
// CONEXIÓN FINAL
// ==========================================

client.login(process.env.DISCORD_TOKEN);
