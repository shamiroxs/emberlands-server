import { WebSocketServer } from 'ws'
import { v4 as uuidv4 } from 'uuid'
import http from 'http'

const server = http.createServer()
const wss = new WebSocketServer({ port: 8080 })
const clients = new Map()

wss.on('connection', (ws) => {
  const clientId = uuidv4()
  clients.set(clientId, ws)

  ws.send(JSON.stringify({ type: 'init', id: clientId }))

  ws.on('message', (message) => {
    let data
    try {
      data = JSON.parse(message)
    } catch (err) {
      return
    }

    // Broadcast 
    if (data.type === 'move') {
      const msg = JSON.stringify({
        type: 'playerUpdate',
        id: clientId,
        position: data.position,
        rotationY: data.rotationY || 0,
        state: data.state || 'idle'
      })

      for (const [id, client] of clients.entries()) {
        if (client !== ws && client.readyState === 1) {
          client.send(msg)
        }
      }
    }

    // Duel
    if (data.type === 'duelRequest') {
      const opponent = clients.get(data.to)
      if (opponent) {
        opponent.send(JSON.stringify({
          type: 'duelInvite',
          from: data.from
        }))
      }
    }

    if (data.type === 'duelAccepted') {
      const opponent = clients.get(data.to)
      if (opponent && opponent.readyState === 1) {
        opponent.send(JSON.stringify({
          type: 'duelAccepted',
          from: data.from
        }))
      }
    }

    if (data.type === 'healthUpdate') {
      const { id, health } = data
    
      for (const [pid, client] of clients.entries()) {
        if (pid !== id && client.readyState === 1) {
          client.send(JSON.stringify({
            type: 'healthUpdate',
            id,
            health
          }))
        }
      }
    }

    if (data.type === 'duelAttack') {
      const target = clients.get(data.to)
      if (target) {
        target.send(JSON.stringify({
          type: 'applyDamage',
          from: data.from,
          damage: data.damage
        }))
      }
    }
    
    if (data.type === 'duelEnd') {
      const { loserId, winnerId} = data
      const target = clients.get(winnerId)

      if(target){
        target.send(JSON.stringify({
          type: 'duelEnd',
          loserId,
          winnerId
        }))
      }
    }    
  })

  ws.on('close', () => {
    clients.delete(clientId)
    const disconnectMsg = JSON.stringify({
      type: 'disconnect',
      id: clientId,
    })
    for (const client of clients.values()) {
      if (client.readyState === 1) client.send(disconnectMsg)
    }
  })
})

const PORT = process.env.PORT || 8080
server.listen(PORT, '0.0.0.0', () => {
  console.log(`WebSocket server running on port ${PORT}`)
})
