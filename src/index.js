  const { PrismaClient } = require('@prisma/client');
  const prisma = new PrismaClient()
  const express = require('express');
  const mysql = require('mysql')

  const app = express();
  const connection = mysql.createConnection(process.env.DATABASE_URL)
  console.log('Connected to PlanetScale!')

  require('dotenv').config()

  app.use(express.json());
  app.use(function(req, res, next) {
      res.setHeader("Access-Control-Allow-Origin", "*");
      res.setHeader('Access-Control-Allow-Methods', 'POST,GET,OPTIONS,PUT,DELETE');
      res.setHeader("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
      next();
    });

  app.listen(3001, () => {
      console.log('Server is running on port 3001');
  });

  app.get('/', (req, res) => {
      res.send('Welcome to EPMATCH API!');
  });


  app.post('/CreateUser', async (req, res) => {
    try {
      const { Nombre, Mail, Password, Edad, Barrio, Sexo, EdadMin, EdadMax, Cumpleaos } = req.body;
  
      // Verificar si el correo electrónico ya está en uso
      const existingUser = await prisma.datospersonales.findUnique({
        where: {
          Mail: Mail,
        },
      });
  
      if (existingUser) {
        return res.status(400).json({ error: 'El correo electrónico ya está en uso' });
      }
  
      // Si no hay un usuario con el mismo correo, proceder con la creación
      const creacion = await prisma.datospersonales.create({
        data: {
          "Mail": Mail,
          "Nombre": Nombre,
          "Password": Password,
          "Edad": parseInt(Edad),
          "Barrio": Barrio,
          "Sexo": Sexo,
          "EdadMin": parseInt(EdadMin),
          "EdadMax": parseInt(EdadMax),
          "Cumpleaos": Cumpleaos
        }
      });
  
      res.json(creacion);
    } catch (error) {
      console.error('Error al crear el usuario:', error);
      res.status(500).json({ error: 'Error interno del servidor' });
    }
  });
  
  app.get('/GetUsers', async (req, res) => {
      const users = await prisma.datospersonales.findMany();
      res.json(users);
    }
  );


  app.post('/FindUser', async (req, res) => {
      const { Mail, Password } = req.body;
      const user = await prisma.datospersonales.findFirst({
        where: {
          Mail: Mail,
          Password: Password
          }
      }); 
      res.json(user);
    });

    app.post('/UpdateUser', async (req, res) => {
      const { Mail, Nombre, Password, Edad, Barrio, Sexo, EdadMin, EdadMax, Cumpleaos} = req.body;
      const update = await prisma.datospersonales.update({
          where: {
              Mail: Mail,
              Password: Password
          },
          data:{
              "Edad": parseInt(Edad),
            "Nombre": Nombre,
              "Barrio": Barrio,
              "Sexo": Sexo,
              "EdadMin": parseInt(EdadMin),
              "EdadMax": parseInt(EdadMax),
              "Cumpleaos": Cumpleaos
          }
      })
      res.json(update)
  }
  )



  app.post('/AddActivity', async (req, res) => {
      const { activity } = req.body;
      const crear = await prisma.intereses.create({
          data:{
              "Interes": activity
          }
      })
      res.json(crear)
  })

  app.get('/GetActivities', async (req, res) => {
      const activities = await prisma.intereses.findMany();
      res.json(activities);
  } 
  );
  

  app.post('/RegisterActivity', async (req, res)=> {
      const {userId, activity} = req.body;
      const find = await prisma.intereses.findUnique({
          where:{
              "Interes": activity
          }
      })
      if(find != null){
      const activityId = find.id;
      const avoidRepeat = await prisma.interesesusuarios.findMany({
          where:{
              "IdUsuario": userId,
              "IdInteres": activityId
          }
      })
      if(avoidRepeat.length > 0){
          res.status(505).json("Ya estas registrado en esta actividad");
      }
      else{

      const register = await prisma.interesesusuarios.create({
          data:{
              "IdUsuario": userId,
              "IdInteres": activityId

          }
      })
      res.status(200).json(register);
      }
      }
      else{
          res.send("No existe esa actividad");
      }
      
  })
  app.post('/DeleteActivity', async (req, res) => {
    try {
      const { userId, activity } = req.body;
      const deleteActivity = await prisma.interesesusuarios.deleteMany({
        where: {
          IdUsuario: userId,
          IdInteres: activity,
        },
      });

      res.json(deleteActivity);
    } catch (error) {
      console.error('Error al eliminar la actividad:', error);
      res.status(500).json({ error: 'Error interno del servidor' });
    }
  });

  app.post('/GetActivities', async (req, res) => {
      const { userId } = req.body;
      const activities = await prisma.interesesusuarios.findMany({
          where: {
              "IdUsuario": userId
          },
      });

      // Usamos Promise.all para esperar todas las operaciones asincrónicas
      const listaActividades = await Promise.all(activities.map(async (element) => {
          const actividad = await prisma.intereses.findUnique({
              where: {
                  "id": element.IdInteres
              }
          });
          return actividad;
      }));

      res.json(listaActividades);
  });

  app.get('/GetUsersByActivity', async (req, res) => {
    const users = await prisma.interesesusuarios.findMany();
    res.json(users);
  });

  app.post('/Match', async (req, res) => {
    try {
      const { userId } = req.body;
      const userData = await prisma.datospersonales.findFirst({
        where: {
        id: userId,
          }
      }); 


      const interesesUsuario = await prisma.interesesusuarios.findMany({
        where: {
          IdUsuario: userId,
        },
      });

      const usuariosConInteresesComunes = await prisma.interesesusuarios.findMany({
        where: {
          IdInteres: {
            in: interesesUsuario.map((interes) => interes.IdInteres),
          },
          IdUsuario: {
            not: userId,
          },
        },
      });

      const detallesUsuarios = {};
      if (usuariosConInteresesComunes.length === 0) {
        res.send("No hay usuarios con intereses en común")
        return;
      }
      else{
      await Promise.all(
        
        usuariosConInteresesComunes.map(async (usuario) => {
          const detallesUsuario = await obtenerDetallesUsuario(usuario.IdUsuario);
          const actividadesEnComun = await obtenerActividadesEnComun(usuario.IdInteres);

          // Verificar la edad del usuario actual y del usuario encontrado
          if (
            verificarRangoEdad(userData.Edad, detallesUsuario.EdadMax, detallesUsuario.EdadMin) &&
            verificarRangoEdad(detallesUsuario.Edad, userData.EdadMax, userData.EdadMin)
          ) {
            if (!detallesUsuarios[usuario.IdUsuario]) {
              detallesUsuarios[usuario.IdUsuario] = {
                ...detallesUsuario,
                actividadesEnComun: [],
              };
            }

            detallesUsuarios[usuario.IdUsuario].actividadesEnComun.push(...actividadesEnComun);
          }
        })
      );

      // Convertir el objeto de detallesUsuarios a un array
      const resultadoFinal = Object.values(detallesUsuarios);

      res.json(resultadoFinal);
    }} catch (error) {
      console.error('Error al buscar usuarios por intereses:', error);
      res.status(500).json({ error: 'Error interno del servidor' });
    }
  });

  function verificarRangoEdad(edad, edadMax, edadMin) {
    return edad >= edadMin && edad <= edadMax;
  }

  async function obtenerDetallesUsuario(idUsuario) {
    return prisma.datospersonales.findUnique({
      where: {
        id: idUsuario,
      },
      select: {
        id: true,
        Mail: true,
        Edad: true,
        Barrio: true,
        Sexo: true,
        EdadMax: true,
        EdadMin: true,
      },
    });
  }

  async function obtenerActividadesEnComun(idInteres) {
    return prisma.intereses.findMany({
      where: {
        id: idInteres,
      },
      select: {
        Interes: true,
      },
    });
  }



  module.exports = app;