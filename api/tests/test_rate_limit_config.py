"""Les limites de débit doivent être configurables, et calibrées pour une salle.

Contexte : toutes les limites sont indexées sur l'IP client
(`Limiter(key_func=get_remote_address)`). Dans une salle de classe, les ~30
élèves partagent **une seule** IP publique (NAT du wifi de l'établissement) —
donc chaque limite « par IP » est en réalité une limite **pour toute la salle**.

Avec les valeurs d'origine, seuls 15 élèves pouvaient créer un compte par heure,
et la salle entière partageait 10 connexions/minute et 10 votes/minute.

À ne pas confondre avec l'incident du 2026-05-26 : celui-là venait de
`--proxy-headers` manquant, qui écrasait des IP *distinctes* dans un seul
compteur. Ce correctif-là fonctionne. Le problème ici est que le comptage par IP
est désormais *correct* — et qu'un comptage par IP correct est exactement ce
qu'il ne faut pas dans une salle où l'IP est unique.
"""

import re
from pathlib import Path

import pytest

from app.config import settings

ROUTERS_DIR = Path(__file__).resolve().parents[1] / "app" / "routers"

# Un décorateur du type @limiter.limit("10/minute") — valeur en dur.
HARDCODED_LIMIT = re.compile(r'@limiter\.limit\(\s*["\']\d+\s*/')


def test_no_hardcoded_rate_limits_remain():
    """Toute limite doit venir de `settings`, jamais d'un littéral.

    C'est le garde-fou de non-régression : une nouvelle route qui arrive avec
    une valeur en dur casse ce test, au lieu de casser silencieusement une
    intervention six mois plus tard.
    """
    offenders = []
    for path in sorted(ROUTERS_DIR.glob("*.py")):
        for lineno, line in enumerate(path.read_text(encoding="utf-8").splitlines(), 1):
            if HARDCODED_LIMIT.search(line):
                offenders.append(f"{path.name}:{lineno}: {line.strip()}")

    assert not offenders, (
        "Limites de débit en dur — elles doivent passer par `settings` pour "
        "rester réglables le jour J sans rebuild :\n  " + "\n  ".join(offenders)
    )


# Plancher minimal pour une salle d'environ 30 élèves, avec les reprises.
# Ce ne sont pas les valeurs retenues : ce sont les valeurs en-dessous
# desquelles une salle se bloque.
CLASSROOM_FLOORS = [
    ("rate_limit_signup_per_hour", 60, "création de compte, une seule fois par élève"),
    ("rate_limit_login_per_min", 40, "reconnexions, en rafale en début de séance"),
    ("rate_limit_login_qr_per_min", 40, "retours par QR depuis les téléphones"),
    ("rate_limit_quiz_submit_per_min", 60, "réponses de quiz, plusieurs par élève"),
    ("rate_limit_vote_per_min", 60, "vote initial, toute la salle en même temps"),
    ("rate_limit_question_per_min", 40, "questions posées pendant la séance"),
    ("rate_limit_reaction_per_min", 120, "réactions sur le mur, les plus fréquentes"),
    ("rate_limit_discord_click_per_min", 40, "clics sur l'invitation Discord"),
    ("rate_limit_easter_egg_per_min", 40, "konami, viral dès qu'un élève le trouve"),
    ("rate_limit_events_per_min", 300, "télémétrie badges/animations, la plus bavarde"),
]


@pytest.mark.parametrize("name,floor,why", CLASSROOM_FLOORS)
def test_default_is_calibrated_for_a_shared_ip(name, floor, why):
    """Chaque défaut doit tenir une salle entière derrière une IP unique."""
    assert hasattr(settings, name), f"réglage absent : {name}"
    value = getattr(settings, name)
    assert value >= floor, (
        f"{name}={value} est en-dessous du plancher salle ({floor}) — {why}. "
        "Toute la salle partage ce compteur."
    )
