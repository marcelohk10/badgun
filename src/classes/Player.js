import Phaser from 'phaser'
import PlayerSprite from '../sprites/Player'
import { setTimeout, clearTimeout } from 'timers'
import { debugHTML, convertRange } from '../utils'
import CarExplosion from '../sprites/CarExplosion'
import SoundManager from './SoundManager'

const fn = require('lodash/function')

export const STATE_NORMAL = 'normal'
export const STATE_COLLIDED = 'collided'
export const STATE_INVINCIBLE = 'invincible'

const COLLISION_OFFSET = 10

export default class Player {
  playerConfig = {
    initialVelocity: -1000,
    maxVelocity: -1500,
    minVelocity: -500,
    turnVelocity: 30,
    acceleration: 10,
    deceleration: 25,
    state: STATE_NORMAL
  }

  turning = false

  constructor (game, playerGroup, playerCollisionGroup) {
    this.game = game
    this.playerGroup = playerGroup
    this.playerCollisionGroup = playerCollisionGroup
    this.playerGroup.physicsBodyType = Phaser.Physics.P2JS
    this.playerGroup.enableBody = true
    this.playerConfig = this.getPlayerConfigForStage(1)
    this.setupPlayer()
    // this.setupCrashEffect()

    this.showPlayer = this._showPlayer.bind(this)
    this.playerRecovered = this._playerRecovered.bind(this)
    this.returnToNormalState = this._returnToNormalState.bind(this)

    this.explosionSignal = new Phaser.Signal()
    this.explosionSignal.add(this._onExplosionFinished.bind(this))
    this.throttledSoundSetPlaybackRate = fn.throttle((value) => { SoundManager.setSoundPlaybackRate(this.carEngineSound, value) }, 200)

    this.carEngineSound = SoundManager.getFXByName('carengine')
  }

  getPlayerConfigForStage (stageNum) {
    let limitedStageNum = Math.min(stageNum, 10)
    let baseVelocity = 600
    let stageIncrement = 100
    let initialVelocity = -1 * (baseVelocity + (limitedStageNum * stageIncrement))
    let config = {
      initialVelocity: initialVelocity,
      maxVelocity: initialVelocity * 1.3,
      minVelocity: initialVelocity * 0.5,
      turnVelocity: 30,
      acceleration: 7 + (limitedStageNum * (stageIncrement / 50)),
      deceleration: 20 + (limitedStageNum * (stageIncrement / 50))
    }

    let newConfig = Object.assign({}, this.playerConfig, config)
    return newConfig
  }

  setupPlayer () {
    this.playerDef = new PlayerSprite({
      game: this.game,
      x: this.game.world.centerX,
      y: this.game.world.height - this.game.height / 2,
      asset: 'car'
    })
    this.playerDef.anchor.set(0.5)
    this.sprite = this.playerGroup.add(this.playerDef)
    this.game.physics.p2.enable(this.sprite, false)
    // this.game.physics.enable(this.player, Phaser.Physics.ARCADE)
    // this.player.body.maxAngular = 100
    // this.player.body.angularDrag = 150
    // this.player.body.collideWorldBounds = true

    // this.player.body.immovable = true
    this.sprite.body.fixedRotation = true
    this.sprite.body.damping = 0
    this.sprite.body.friction = 1

    this.sprite.body.setRectangle(this.sprite.width - 4, this.sprite.height - 4)

    this.sprite.body.setCollisionGroup(this.playerCollisionGroup)

    this.game.camera.focusOn(this.sprite)
    this.sprite.body.velocity.y = this.playerConfig.initialVelocity
    this.playerConfig.state = STATE_NORMAL
  }

  update () {
    if (!this.startTime) {
      this.startTime = this.game.time.now
      this.startY = this.sprite.body.y
    }
    /*
    let currY = this.sprite.body.y
    // console.log('TimeDiff: '+ (this.game.time.now - this.lastUpdate) + ' ydiff: ' + (this.lastY - currY))
    let avgTotal = (this.sprite.body.y - this.startY) / ((this.game.time.now - this.startTime) / 1000)
    let avg = (this.lastY - currY) / ((this.game.time.now - this.lastUpdate) / 1000)
    // console.log('TotalTDiff: '+ (this.game.time.now - this.startTime) +' TY: '+(this.sprite.body.y - this.startY)+ 'AVGTotal: '+avgTotal+' AVG: '+avg)
    // console.log('Velo: '+this.sprite.body.velocity.y)
    this.lastUpdate = this.game.time.now
    this.lastY = currY */
    if (this.playerConfig.state === STATE_COLLIDED) {
      return
    }

    if (this.game.input.keyboard.isDown(Phaser.Keyboard.LEFT) || this.game.input.keyboard.isDown(65)) {
      this.sprite.rotation = Phaser.Math.clamp(this.sprite.rotation - 0.02, -0.2, 0)
      this.turning = true
      if (this.sprite.body.velocity.x > 0) {
        this.sprite.body.velocity.x = 0
      }
      this.sprite.body.thrustLeft(this.playerConfig.turnVelocity * 40)
      // this.sprite.body.velocity.x = Phaser.Math.clamp(this.sprite.body.velocity.x - this.playerConfig.turnVelocity, -1 * this.playerConfig.turnVelocity * 20, 0)
    } else if (this.game.input.keyboard.isDown(Phaser.Keyboard.RIGHT) || this.game.input.keyboard.isDown(68)) {
      this.sprite.rotation = Phaser.Math.clamp(this.sprite.rotation + 0.02, 0, 0.2)
      this.turning = true
      if (this.sprite.body.velocity.x < 0) {
        this.sprite.body.velocity.x = 0
      }
      this.sprite.body.thrustRight(this.playerConfig.turnVelocity * 40)
      // this.sprite.body.velocity.x = Phaser.Math.clamp(this.sprite.body.velocity.x + this.playerConfig.turnVelocity, 0, this.playerConfig.turnVelocity * 20)
    } else {
      // Reset position
      if (this.sprite.body.velocity.x > 0) {
        this.sprite.body.velocity.x = Math.max(this.sprite.body.velocity.x - this.playerConfig.turnVelocity * 1.75, 0)
      } else if (this.sprite.body.velocity.x < 0) {
        this.sprite.body.velocity.x = Math.min(this.sprite.body.velocity.x + this.playerConfig.turnVelocity * 1.75, 0)
      }
      if (this.turning) {
        this.turning = false
        this.game.add.tween(this.sprite).to({ rotation: 0 }, 100, 'Linear', true)
      } else if (this.sprite.rotation !== 0) {
        this.sprite.rotation = 0
      }
    }

    if (this.game.input.keyboard.isDown(Phaser.Keyboard.UP) || this.game.input.keyboard.isDown(87)) {
      if (this.sprite.body.velocity.y > this.playerConfig.maxVelocity) {
        this.sprite.body.thrust(this.playerConfig.acceleration * 50)
      }
      // this.sprite.body.velocity.y = Math.max(this.sprite.body.velocity.y - this.playerConfig.acceleration / 5, this.playerConfig.maxVelocity)
    } else if (this.game.input.keyboard.isDown(Phaser.Keyboard.DOWN) || this.game.input.keyboard.isDown(83)) {
      if (this.sprite.body.velocity.y < this.playerConfig.minVelocity) {
        this.sprite.body.reverse(this.playerConfig.deceleration * 50)
      }
      // this.sprite.body.velocity.y = Math.min(this.sprite.body.velocity.y + this.playerConfig.deceleration, this.playerConfig.minVelocity)
    } else {
      let speedDiff = Math.abs(this.sprite.body.velocity.y - this.playerConfig.initialVelocity)
      
      if (speedDiff > 4) {
        if (this.sprite.body.velocity.y > this.playerConfig.initialVelocity) {
          this.sprite.body.thrust(this.playerConfig.acceleration * 30)
        } else if (this.sprite.body.velocity.y < this.playerConfig.initialVelocity) {
          this.sprite.body.reverse(this.playerConfig.acceleration * 20)
        }
      }
      /*
      if (this.sprite.body.velocity.y < this.playerConfig.initialVelocity) {
        this.sprite.body.velocity.y = Math.min(this.sprite.body.velocity.y + this.playerConfig.acceleration / 5, this.playerConfig.initialVelocity)
      } else if (this.sprite.body.velocity.y > this.playerConfig.initialVelocity) {
        this.sprite.body.velocity.y = Math.max(this.sprite.body.velocity.y - this.playerConfig.acceleration / 5, this.playerConfig.initialVelocity)
      } */
    }

    let highRange = convertRange(this.sprite.body.velocity.y, [this.playerConfig.initialVelocity, this.playerConfig.maxVelocity], [1, 1.2])
    let lowRange = convertRange(this.sprite.body.velocity.y, [this.playerConfig.initialVelocity, this.playerConfig.minVelocity], [1, 0.94])
    let rate = highRange < 1 ? lowRange : highRange

    this.throttledSoundSetPlaybackRate(rate)

    let camDiffY = this.game.math.linear(0, this.sprite.body.velocity.y - this.playerConfig.initialVelocity, 0.1)
    camDiffY = 0
    this.game.camera.y = this.sprite.body.y - 3 * (this.game.height / 4) - camDiffY * 5
    // this.sprite.update()
  }

  checkWallCollision (visiblePolygons) {
    let playerWallCollision = false
    visiblePolygons.forEach((poly) => {
      if (poly.contains(this.sprite.x, this.sprite.y) ||
          poly.contains(this.sprite.x - this.sprite.width / 2, this.sprite.y - this.sprite.height / 2) ||
          poly.contains(this.sprite.x + this.sprite.width / 2, this.sprite.y + this.sprite.height / 2)) {
        playerWallCollision = true
      }
    })
    return playerWallCollision
  }

  checkStageElementCollision (visibleBlocks) {
    let playerStageElementCollision = false
    visibleBlocks.forEach((block) => {
      block.stageElementsHitArea.forEach((poly) => {
        if (poly.contains(this.sprite.x, this.sprite.y) ||
          poly.contains(this.sprite.x - this.sprite.width / 2 + COLLISION_OFFSET, this.sprite.y - this.sprite.height / 2 + COLLISION_OFFSET) ||
          poly.contains(this.sprite.x + this.sprite.width / 2 - COLLISION_OFFSET, this.sprite.y + this.sprite.height / 2 - COLLISION_OFFSET)) {
          playerStageElementCollision = {block: block, poly: poly}
        }
      })
    })

    return playerStageElementCollision
  }

  checkCollectableCollision (collectables) {
    let collisions = []
    let bounds = new Phaser.Rectangle(this.sprite.x - this.sprite.width / 2, this.sprite.y - this.sprite.height / 2, this.sprite.width, this.sprite.height)
    // console.dir(bounds)
    collectables.forEach((collectable) => {
      if (Phaser.Rectangle.containsPoint(bounds, collectable.position)) {
        collisions.push(collectable)
      }
    })
    return collisions
  }

  slowDown () {
    this.sprite.body.velocity.y = Math.min(this.sprite.body.velocity.y + this.playerConfig.deceleration, this.playerConfig.minVelocity)
  }

  startRecoveryAnimation () {
    this.playerConfig.state = STATE_COLLIDED
    this.crashPosition = { x: this.sprite.x, y: this.sprite.y }
    this.sprite.visible = false
    this.carEngineSound.stop()
    this._playExplosion()
    this.sprite.body.setZeroVelocity()
    this.sprite.body.setZeroRotation()
    this.sprite.body.setZeroForce()
    this.game.state.getCurrentState().helicopter.moveIn(this.crashPosition.x, this.crashPosition.y, this.showPlayer, this._noop)
  }

  _playExplosion () {
    let explosion = new CarExplosion({ game: this.game, x: this.sprite.x, y: this.sprite.y, asset: 'carExplosion', onComplete: this.explosionSignal })
    explosion.name = 'explosion'
    this.game.badgun.helicopterGroup.add(explosion)
    // this.playerGroup.add(explosion)
  }

  _onExplosionFinished () {
    this.game.badgun.helicopterGroup.remove(this.game.badgun.helicopterGroup.getByName('explosion'))
    // this.playerGroup.remove(this.playerGroup.getByName('explosion'))
  }

  _noop () {

  }

  _showPlayer () {
    this.sprite.visible = true
    SoundManager.setSoundPlaybackRate(this.carEngineSound, 1)
    this.carEngineSound.loopFull(0.3)
    this._playerRecovered()
  }

  _playerRecovered () {
    this.playerConfig.state = STATE_INVINCIBLE
    this.blinkTween = this.game.add.tween(this.sprite)
    this.blinkTween.to({ alpha: 0.2 }, 100, 'Linear', true, 0, -1, true)
    this.blinkTween.start()
    this.invincibleTimer = setTimeout(this.returnToNormalState, 2000)
  }

  _returnToNormalState () {
    this.blinkTween.stop()
    this.sprite.alpha = 1
    this.playerConfig.state = STATE_NORMAL
  }

  startCarEngine () {
    this.carEngineSound.loopFull(0.3)
  }

  fadeOutCarEngine () {
    SoundManager.fadeOutFx(this.carEngineSound)
  }

  setupCrashEffect () {
    this.manager = this.game.plugins.add(Phaser.ParticleStorm)
    
    var data = {
        lifespan: 100
    }

    this.manager.addData('basic', data)

    this.emitter = this.manager.createEmitter(Phaser.ParticleStorm.PIXEL)

    this.emitter.renderer.pixelSize = 8

    this.emitter.addToWorld(this.playerGroup)

    this.image = this.manager.createImageZone('car')

    //  This will use the Pixel Emitter to display our carrot.png Image Zone
    //  Each 'pixel' is 8x8 so we set that as the spacing value
    //  
    //  The 'setColor' property tells the renderer to tint each 'pixel' to match the
    //  color of the respective pixel in the source image.
  }

  startCrashEffect () {
    return
    console.log(this.sprite.y)
    this.emitter.emit('basic', 200, this.sprite.y, { zone: this.image, full: true, spacing: 8, setColor: true })
    // this.emitter.forEachNew(this.crashEffect, this, 200, 200)
  }

  crashEffect (particle, x, y) {
    particle.setLife(3000)
    particle.radiateFrom(x, y, 3)
  }
}
