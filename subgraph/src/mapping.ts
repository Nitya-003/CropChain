import {
  BatchCreated as BatchCreatedEvent,
  BatchUpdated as BatchUpdatedEvent,
  RoleUpdated as RoleUpdatedEvent
} from "../generated/CropChain/CropChain"
import { Batch, BatchUpdate, Role } from "../generated/schema"

export function handleBatchCreated(event: BatchCreatedEvent): void {
  let entity = new Batch(event.params.batchId.toHex())
  
  entity.ipfsCID = event.params.ipfsCID
  entity.quantity = event.params.quantity
  entity.creator = event.params.creator
  
  // Set initial stage to Farmer (0)
  entity.stage = 0
  entity.isRecalled = false
  entity.createdAt = event.block.timestamp
  entity.updatedAt = event.block.timestamp

  entity.save()
}

export function handleBatchUpdated(event: BatchUpdatedEvent): void {
  let batchIdHex = event.params.batchId.toHex()
  let batch = Batch.load(batchIdHex)
  
  if (batch == null) {
    return
  }

  batch.stage = event.params.stage
  batch.updatedAt = event.block.timestamp
  batch.save()

  let updateId = event.transaction.hash.toHex() + "-" + event.logIndex.toString()
  let batchUpdate = new BatchUpdate(updateId)
  
  batchUpdate.batch = batchIdHex
  batchUpdate.stage = event.params.stage
  batchUpdate.actorName = event.params.actorName
  batchUpdate.location = event.params.location
  batchUpdate.updatedBy = event.params.updatedBy
  batchUpdate.timestamp = event.block.timestamp
  
  batchUpdate.save()
}

export function handleRoleUpdated(event: RoleUpdatedEvent): void {
  let entity = new Role(event.params.user.toHex())
  
  entity.role = event.params.role
  entity.updatedAt = event.block.timestamp
  
  entity.save()
}
