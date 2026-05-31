# VM Secrets

No VM key material belongs in this repo.

Operators should keep deploy keys under `~/.ssh` and export:

```sh
export OOOLALA_VM_SSH_KEY="$HOME/.ssh/keys/ooolala-prod"
```

The deploy scripts fail fast when the key path is missing or unreadable. If a
VM key is rotated, update the local `OOOLALA_VM_SSH_KEY` value and install the
new public key on the VM outside this repo.
