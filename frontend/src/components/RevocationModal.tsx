"use client"

import React, { useState } from 'react'
import { AlertTriangle } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from './ui/dialog'
import { Button } from './ui/button'

interface RevocationModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Called when the dialog is closing, regardless of trigger (overlay click, Esc, Cancel button, etc.) */
  onClose?: () => void
  userName: string
  onConfirm: (reason: string) => void
  isProcessing?: boolean
}


export function RevocationModal({
  open,
  onOpenChange,
  onClose,
  userName,
  onConfirm,
  isProcessing = false,
}: RevocationModalProps) {
  const [reason, setReason] = useState('')
  const [error, setError] = useState('')

  const handleConfirm = () => {
    if (!reason.trim()) {
      setError('Revocation reason is required')
      return
    }
    onConfirm(reason.trim())
  }

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      setReason('')
      setError('')
      onClose?.()
    }
    onOpenChange(newOpen)
  }


  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="h-5 w-5" />
            Revoke Credential
          </DialogTitle>
          <DialogDescription>
            You are about to revoke the verified credential for{' '}
            <strong className="text-foreground">{userName}</strong>.
            This action cannot be undone.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          <label
            htmlFor="revocation-reason"
            className="text-sm font-medium text-foreground"
          >
            Revocation Reason
          </label>
          <textarea
            id="revocation-reason"
            value={reason}
            onChange={(e) => {
              setReason(e.target.value)
              if (error) setError('')
            }}
            placeholder="Enter the reason for revocation..."
            rows={3}
            className={`w-full px-3 py-2 text-sm rounded-md border bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 ${
              error ? 'border-destructive' : 'border-input'
            }`}
            disabled={isProcessing}
            autoFocus
          />
          {error && (
            <p className="text-xs text-destructive flex items-center gap-1">
              {error}
            </p>
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            variant="outline"
            onClick={() => handleOpenChange(false)}
            disabled={isProcessing}
          >
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={handleConfirm}
            disabled={isProcessing}
          >
            {isProcessing ? 'Revoking...' : 'Confirm Revoke'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
