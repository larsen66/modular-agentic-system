# VM deploy for custom TS kernel

Current public shape:

- Vercel builds and serves the `apps/next` island (`apps/next/dist`).
- Vercel rewrites backend routes to `http://204.168.143.213:8090`.
- The VM backend should run this package as a long-lived Node service on port `8090`.

## One-time VM setup

From a shell on the VM:

```bash
sudo cp deploy/systemd/custom-ts-kernel.service /etc/systemd/system/custom-ts-kernel.service
sudo systemctl daemon-reload
sudo systemctl enable custom-ts-kernel
```

Check the service file paths before enabling if the repo is not under:

```text
/home/agiens/vbp-german/docs/modular-agentic-system/builds/01-custom-ts-kernel
```

The service reads `.env` and `.harness.env` from the project directory. Keep secrets on the VM, not in git.

## Deploy

From the project directory on your laptop:

```bash
bash scripts/deploy-vm.sh
```

Defaults:

- SSH target: `agiens@204.168.143.213`
- Remote repo: `/home/agiens/vbp-german`
- Branch: `main`
- Project subdir: `docs/modular-agentic-system/builds/01-custom-ts-kernel`
- systemd service: `custom-ts-kernel`

Override example:

```bash
bash scripts/deploy-vm.sh agiens@204.168.143.213 /home/agiens/modular-agentic-system main builds/01-custom-ts-kernel
```

## Health checks

```bash
curl -fsS http://204.168.143.213:8090/healthz
curl -fsS https://dav-version.vercel.app/healthz
```

If direct `:8090` works but Vercel fails, check `vercel.json` rewrites. If both fail, check:

```bash
ssh agiens@204.168.143.213 'systemctl status custom-ts-kernel --no-pager'
ssh agiens@204.168.143.213 'journalctl -u custom-ts-kernel -n 100 --no-pager'
```
