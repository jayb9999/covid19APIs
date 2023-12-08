const express = require('express')
const path = require('path')
const {open} = require('sqlite')
const sqlite3 = require('sqlite3')
const bcrypt = require('bcrypt')
const jwt = require('jsonwebtoken')
const dbPath = path.join(__dirname, 'covid19IndiaPortal.db')
const app = express()
app.use(express.json())

let db = null
const intializeDBAndServer = async () => {
  try {
    db = await open({
      filename: dbPath,
      driver: sqlite3.Database,
    })
    app.listen(3000, () => {
      console.log('Server Running at http://localhost:3000/')
    })
  } catch (e) {
    console.log(`DB Error: ${emessage}`)
    process.exit(1)
  }
}
intializeDBAndServer()

//1

const authenticateToken = (request, response, next) => {
  let jwtToken
  const authHeader = request.headers['authorization']
  if (authHeader !== undefined) {
    jwtToken = authHeader.split(' ')[1]
  }
  if (jwtToken === undefined) {
    //response.status(401)
    response.send('Invalid JWT Token')
  } else {
    jwt.verify(jwtToken, 'abcdefg', async (error, payload) => {
      if (error) {
        //response.status(401)
        response.send('Invalid JWT Token')
      } else {
        request.username = payload.username
        next()
      }
    })
  }
}

app.post('/register/', async (request, response) => {
  const registerDetails = request.body
  const {username, name, password, gender, location} = registerDetails
  const checkQuery = `SELECT * FROM user WHERE username = '${username}';`
  const dbUser = await db.get(checkQuery)
  const hashedPassword = await bcrypt.hash(password, 10)
  if (dbUser === undefined) {
    const createUserQuery = `
      INSERT INTO
        user (username, name, password, gender, location)
      VALUES ('${username}', '${name}', '${hashedPassword}', '${gender}', '${location}');`
    await db.run(createUserQuery)
    response.send('New User Registered')
  } else {
    //response.status(400)
    response.send('User already exists')
  }
})

app.post('/login/', async (request, response) => {
  const userDetails = request.body
  const {username, password} = userDetails
  const checkUseQuery = `SELECT * FROM user WHERE username = '${username}';`
  const dbUser = await db.get(checkUseQuery)
  if (dbUser === undefined) {
    //response.status(400)
    response.send('Invalid User')
  } else {
    const isPswdMatched = await bcrypt.compare(password, dbUser.password)
    if (isPswdMatched) {
      const payload = {username: username}
      const jwtToken = jwt.sign(payload, 'abcdefg')
      response.send({jwtToken})
    } else {
      //response.status(400)
      response.send('Invalid Password')
    }
  }
})

//2 Returns a list of all states in the state table
app.get('/states/', authenticateToken, async (request, response) => {
  const query = `SELECT * FROM state;`
  let statelist = await db.all(query)
  statelist = statelist.map(each => ({
    stateId: each.state_id,
    stateName: each.state_name,
    population: each.population,
  }))
  response.send(statelist)
})

//3 Returns a state based on the state ID
app.get('/states/:stateId/', authenticateToken, async (request, response) => {
  const {stateId} = request.params
  const query = `SELECT * FROM state WHERE state_id = ${stateId};`
  let st = await db.get(query)
  st = {
    stateId: st.state_id,
    stateName: st.state_name,
    population: st.population,
  }
  response.send(st)
})

//4 Create a district in the district table, district_id is auto-incremented
app.post('/districts/', authenticateToken, async (request, response) => {
  const toAdd = request.body
  const {districtName, stateId, cases, cured, active, deaths} = toAdd
  query = `
    INSERT INTO
      district (district_name, state_id, cases, cured, active, deaths)
    VALUES ('${districtName}', ${stateId}, ${cases}, ${cured}, ${active}, ${deaths});`
  await db.run(query)
  response.send('District Successfully Added')
})

//5 Returns a district based on the district ID
app.get(
  '/districts/:districtId/',
  authenticateToken,
  async (request, response) => {
    const {districtId} = request.params
    const query = `SELECT * FROM district WHERE district_id = ${districtId};`
    let dist = await db.get(query)
    dist = {
      districtId: dist.district_id,
      districtName: dist.district_name,
      stateId: dist.state_id,
      cases: dist.cases,
      cured: dist.cured,
      active: dist.active,
      deaths: dist.deaths,
    }
    response.send(dist)
  },
)

//6 Deletes a district from the district table based on the district ID
app.delete(
  '/districts/:districtId/',
  authenticateToken,
  async (request, response) => {
    const {districtId} = request.params
    const query = `DELETE FROM district WHERE district_id = ${districtId};`
    await db.run(query)
    response.send('District Removed')
  },
)

//7 Updates the details of a specific district based on the district ID
app.put(
  '/districts/:districtId/',
  authenticateToken,
  async (request, response) => {
    const {districtId} = request.params
    const {districtName, stateId, cases, cured, active, deaths} = request.body
    const query = `
    UPDATE
      district
    SET
      district_name = '${districtName}',
      state_id = ${stateId},
      cases = ${cases},
      cured = ${cured},
      active = ${active},
      deaths = ${deaths}
    WHERE
      district_id = ${districtId};`
    await db.run(query)
    response.send('District Details Updated')
  },
)

//8 Returns the statistics of total cases, cured, active, deaths of a specific state based on state ID
app.get(
  '/states/:stateId/stats/',
  authenticateToken,
  async (request, response) => {
    const {stateId} = request.params
    const query = `
    SELECT
      SUM(cases) AS totalCases,
      SUM(cured) AS totalCured,
      SUM(active) AS totalActive,
      SUM(deaths) AS totalDeaths
    FROM
      district
    WHERE
      state_id = ${stateId}
    ;`
    let stat = await db.get(query)
    response.send(stat)
  },
)

module.exports = app
