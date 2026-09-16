#!/usr/bin/env bash
# PROVISION-HOST — what a bare VM needs before it can hold this box, and NOTHING about this box.
#
# ★ THE LINE THIS SCRIPT DOES NOT CROSS. It installs a container runtime and makes an unattended machine
# survivable. It does not clone the repo, write an `.env`, pull an image or start a service — those are the
# deploy's job (`bin/deploy.sh <env>`), and keeping them apart is what lets this file be the SELF-HOST runbook's
# executable half for ANY provider: the only Vultr-shaped thing here is the `apt` line, and that is Ubuntu's.
#
# ⚠️ IDEMPOTENT BY CONSTRUCTION. A runbook people re-run is a runbook people trust; one that breaks on the
# second run teaches them to be afraid of it, and a frightened operator skips steps. Every gesture below asks
# before it acts and says which of the two it did.
#
# Usage, from a laptop:  ssh root@<host> 'bash -s' < bin/provision-host.sh
#        or on the box:  bash provision-host.sh
set -uo pipefail

TAG='[provision]'
note() { printf '%s %s\n' "$TAG" "$*"; }
die()  { printf '\n%s ⛔ %s\n\n' "$TAG" "$*" >&2; exit 2; }

# ── 0 · REFUSE A MACHINE THIS SCRIPT CANNOT SPEAK FOR ───────────────────────────────────────────────────────
# A script that assumes its distro and is wrong does not fail: it half-succeeds, leaves a box that looks
# provisioned, and the defect surfaces three steps later wearing someone else's name.
[ "$(id -u)" = '0' ] || die 'run as root (this installs packages and writes to /etc).'
. /etc/os-release 2>/dev/null || die '/etc/os-release is missing — this is not a distro this script knows.'
[ "${ID:-}" = 'ubuntu' ] || die "this script speaks Ubuntu and this box says '${ID:-unknown}'. Stop rather than guess."
note "host $(uname -n) · ${PRETTY_NAME} · $(nproc) vCPU · $(free -m --si | awk '/^Mem/{print $2}')MB RAM"

export DEBIAN_FRONTEND=noninteractive

# ── 1 · DOCKER, FROM DOCKER'S OWN REPOSITORY ────────────────────────────────────────────────────────────────
# ⚠️ NOT Ubuntu's `docker.io`. The distro package lags, and more importantly it does not carry the `compose`
# PLUGIN — `docker compose` (the subcommand this box's every script calls) would be absent while `docker` works,
# which is the shape of failure that costs an afternoon.
if command -v docker >/dev/null 2>&1 && docker compose version >/dev/null 2>&1; then
  note "docker    already installed — $(docker --version | cut -d, -f1), $(docker compose version --short)"
else
  note 'docker    installing from download.docker.com'
  apt-get update -qq >/dev/null || die 'apt-get update failed.'
  apt-get install -y -qq ca-certificates curl gnupg >/dev/null || die 'could not install the prerequisites.'
  install -m 0755 -d /etc/apt/keyrings
  if [ ! -s /etc/apt/keyrings/docker.asc ]; then
    curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc || die 'could not fetch the Docker key.'
    chmod a+r /etc/apt/keyrings/docker.asc
  fi
  printf 'deb [arch=%s signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu %s stable\n' \
    "$(dpkg --print-architecture)" "$VERSION_CODENAME" > /etc/apt/sources.list.d/docker.list
  apt-get update -qq >/dev/null || die 'apt-get update failed after adding the Docker repository.'
  apt-get install -y -qq docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin >/dev/null \
    || die 'could not install Docker.'
  note "docker    installed — $(docker --version | cut -d, -f1), $(docker compose version --short)"
fi
systemctl enable --now docker >/dev/null 2>&1 || die 'docker did not start.'

# ── 2 · LOG ROTATION, AND THIS IS THE ONE THAT BITES A BOX NOBODY WATCHES ───────────────────────────────────
# ⚠️ Docker's default json-file driver has NO limit. This box is reborn weekly by a cron and warms ~20 000 URLs
# on every birth, so the access log of one front alone grows without end — and the failure mode is not "logs are
# big": it is the DISK FILLING, which stops Postgres from writing and takes the shop down for a reason whose
# name appears nowhere near the cause. 10MB × 3 per container is generous for a box that keeps no history here.
if [ -s /etc/docker/daemon.json ] && grep -q 'max-size' /etc/docker/daemon.json 2>/dev/null; then
  note 'logs      rotation already declared in /etc/docker/daemon.json'
else
  mkdir -p /etc/docker
  cat > /etc/docker/daemon.json <<'JSON'
{
  "log-driver": "json-file",
  "log-opts": { "max-size": "10m", "max-file": "3" }
}
JSON
  systemctl restart docker >/dev/null 2>&1 || die 'docker did not come back after writing daemon.json.'
  note 'logs      rotation set — 10m × 3 per container (the default is UNBOUNDED)'
fi

# ── 3 · SWAP — A NET, NOT A DESIGN ─────────────────────────────────────────────────────────────────────────
# Postgres, Redis and four Node servers on 2GB is tight by intention (the point of this exemplar is a box a
# medium customer actually pays for). Swap does not make it roomy; it makes the tight moment a slow second
# instead of an OOM kill that takes whichever container the kernel liked least. `swappiness=10` keeps it as the
# exception it should be.
if swapon --show=NAME --noheadings 2>/dev/null | grep -q .; then
  note "swap      already present — $(free -h --si | awk '/^Swap/{print $2}')"
else
  fallocate -l 2G /swapfile 2>/dev/null || dd if=/dev/zero of=/swapfile bs=1M count=2048 status=none
  chmod 600 /swapfile && mkswap /swapfile >/dev/null && swapon /swapfile || die 'could not enable swap.'
  grep -q '^/swapfile' /etc/fstab || printf '/swapfile none swap sw 0 0\n' >> /etc/fstab
  printf 'vm.swappiness=10\n' > /etc/sysctl.d/99-forge-swap.conf && sysctl -q -p /etc/sysctl.d/99-forge-swap.conf
  note 'swap      2G enabled, swappiness=10, persisted in /etc/fstab'
fi

# ── 4 · THE DOOR: KEYS ONLY ────────────────────────────────────────────────────────────────────────────────
# The VM was born with a key and no password, so password auth is already unusable — this DECLARES it, which is
# a different thing: a later `passwd root` typed by a tired hand would silently re-open what nobody re-checked.
# ⛔⛔ THE NUMBER IN THE FILENAME IS LOAD-BEARING, AND `99-` WAS WRONG — MEASURED ON THE FIRST REAL RUN
# (2026-09-16, the staging VM). In sshd_config the FIRST obtained value wins, and the drop-in directory is read
# in lexical order. Vultr's cloud-init writes `/etc/ssh/sshd_config.d/50-cloud-init.conf` with
# `PasswordAuthentication yes`, so a file named `99-forge.conf` is parsed AFTER it and is silently ignored:
# the config said `no`, `sshd -T` said `yes`, and nothing anywhere was red. ⇒ this file must sort BEFORE the
# provider's. ★ AND THIS IS WHY THE VERDICT AT THE BOTTOM PRINTS `sshd -T` RATHER THAN THE FILE IT JUST WROTE:
# a script that reports what it INTENDED cannot catch this class of defect — only reading back the effective
# value can, and that is the whole difference between a declaration and a measurement.
sshd_changed=0
mkdir -p /etc/ssh/sshd_config.d
rm -f /etc/ssh/sshd_config.d/99-forge.conf
want='/etc/ssh/sshd_config.d/01-forge.conf'
cat > "$want.new" <<'CONF'
# Written by bin/provision-host.sh. The VM is reached by key; this makes that a RULE rather than a fact.
PasswordAuthentication no
KbdInteractiveAuthentication no
PermitRootLogin prohibit-password
CONF
if ! cmp -s "$want.new" "$want" 2>/dev/null; then mv "$want.new" "$want"; sshd_changed=1; else rm -f "$want.new"; fi
if [ "$sshd_changed" = '1' ]; then
  sshd -t 2>/dev/null || die 'the new sshd config does not parse — NOT reloading; the door stays as it was.'
  systemctl reload ssh >/dev/null 2>&1 || systemctl reload sshd >/dev/null 2>&1 || true
  note 'ssh       password auth refused by declaration (config validated before reload)'
else
  note 'ssh       already declared key-only'
fi

# ── 5 · SECURITY UPDATES, UNATTENDED ───────────────────────────────────────────────────────────────────────
# ⚠️ SECURITY ONLY, and no automatic reboot. A box that reboots itself at 3am is a box that can be down at 3am
# with the cycle half-run; a box that never patches is worse. This takes the patches and leaves the reboot to a
# human, which is the same division the pin already uses for versions.
if dpkg -s unattended-upgrades >/dev/null 2>&1; then
  note 'patches   unattended-upgrades already installed'
else
  apt-get install -y -qq unattended-upgrades >/dev/null || die 'could not install unattended-upgrades.'
  cat > /etc/apt/apt.conf.d/99-forge-unattended <<'CONF'
Unattended-Upgrade::Automatic-Reboot "false";
CONF
  systemctl enable --now unattended-upgrades >/dev/null 2>&1 || true
  note 'patches   unattended-upgrades on, automatic reboot OFF (a reboot is a human gesture)'
fi

# ── THE VERDICT ────────────────────────────────────────────────────────────────────────────────────────────
printf '\n%s ── what this host can now do ──\n' "$TAG"
printf '%s   docker        %s\n' "$TAG" "$(docker --version | cut -d, -f1)"
printf '%s   compose       %s\n' "$TAG" "$(docker compose version --short)"
printf '%s   log rotation  %s\n' "$TAG" "$(grep -o '"max-size": *"[^"]*"' /etc/docker/daemon.json | head -1)"
printf '%s   swap          %s\n' "$TAG" "$(free -h --si | awk '/^Swap/{print $2}')"
printf '%s   disk free     %s\n' "$TAG" "$(df -h --output=avail / | tail -1 | tr -d ' ')"
pw="$(sshd -T 2>/dev/null | awk '/^passwordauthentication/{print $2}')"
printf '%s   password auth %s\n' "$TAG" "$pw"
# ⚠️ A VERDICT THAT ONLY PRINTS IS A REPORT; this one REFUSES. The defect above was found by reading this
# number, and a number nobody acts on gets skimmed the second time.
[ "$pw" = 'no' ] || die "sshd still accepts passwords ($pw) after this script declared otherwise — read the drop-in order in /etc/ssh/sshd_config.d/ before trusting this host."
printf '\n%s ✓ provisioned. ⛔ This host holds NO box yet — that is `bin/deploy.sh <env>`.\n\n' "$TAG"
