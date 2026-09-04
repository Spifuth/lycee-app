import type { Metadata } from 'next'
import Link from 'next/link'
import { PageHeader } from '@/components/page-header'
import { Card, CardGrid, CtaRow, Prose, Section, Timeline } from '@/components/content'

export const metadata: Metadata = {
  title: "Cyber — c'est quoi vraiment",
  description:
    "Mythe contre réalité, les trois familles de métiers cyber, une journée type d'analyste SOC, et par où commencer.",
}

const journee = [
  {
    at: '09:00',
    text: "café · stand-up de 15 min avec l'équipe de nuit qui passe le flambeau · 2 alertes en cours sur des connexions VPN suspectes.",
  },
  {
    at: '09:30',
    text: "ouverture du SIEM (la console qui agrège tous les logs de la boîte) · je creuse l'alerte 1 : un compte AD qui essaie 30 logins depuis Manille.",
  },
  {
    at: '10:15',
    text: "escalade : c'est un vrai phishing, le mdp a fuité · je bloque le compte, je reset, je préviens la victime, je rédige un ticket d'incident.",
  },
  {
    at: '11:30',
    text: "veille techno · lecture de 3 advisories CVE · est-ce qu'on est impactés ? je vérifie les versions déployées chez nous.",
  },
  {
    at: '14:00',
    text: 'réunion : on revoit les règles de détection qui font du bruit (faux positifs trop fréquents) · on les retune ensemble.',
  },
  {
    at: '16:00',
    text: "écriture d'une nouvelle règle Sigma pour détecter un comportement vu dans une newsletter.",
  },
  {
    at: '17:45',
    text: "passation à l'équipe du soir · documentation des 2 tickets ouverts dans la journée.",
  },
]

const arguments2026 = [
  {
    eyebrow: 'Pénurie de profils',
    text: "~15 000 postes non pourvus en France selon l'ANSSI. Ça veut dire embauche facile à bac+2 ou bac+5.",
  },
  {
    eyebrow: 'Salaires solides',
    text: 'Analyste SOC junior : ~35-45k€. Pentester senior : 55-80k€. RSSI : 80-150k€. Variable selon Paris/régions.',
  },
  {
    eyebrow: 'Diversité des sujets',
    text: 'Cyber-IA (faux-positifs, modèles attaqués), IoT (objets connectés), OT (industriel), cloud, mobile, post-quantique...',
  },
  {
    eyebrow: 'Jamais la même journée',
    text: "Le métier évolue avec les attaquants. Tu n'arrêtes jamais d'apprendre. C'est ce qui plaît à la plupart des gens qui y restent.",
  },
]

const ressources = [
  { href: 'https://tryhackme.com', label: 'TryHackMe', desc: 'parcours guidés pour débuter' },
  {
    href: 'https://www.root-me.org',
    label: 'Root-Me',
    desc: 'challenges en français, progressifs',
  },
  {
    href: 'https://www.france-cybersecurity-challenge.fr',
    label: 'France Cybersecurity Challenge',
    desc: "compétition annuelle (16-24 ans, gratuit, organisée par l'ANSSI)",
  },
]

export default function CyberPage() {
  return (
    <>
      <PageHeader
        command="cyber"
        title="La cyber — c'est quoi vraiment"
        description="Spoiler : ce n'est pas un mec en hoodie qui tape sur trois écrans en parallèle."
      />

      <div className="mx-auto max-w-6xl px-4 py-12">
        <Prose>
          <Section index="01" title="Mythe vs réalité">
            <CardGrid cols={2}>
              <Card tone="destructive" eyebrow="L'image de la série">
                <ul className="space-y-1">
                  <li>· un type seul dans le noir, hoodie sur la tête</li>
                  <li>· 4 écrans, terminal qui défile en vert</li>
                  <li>· « j'suis dedans » en 12 secondes</li>
                  <li>
                    · l'angle est toujours l'<em>attaque</em>
                  </li>
                </ul>
              </Card>
              <Card tone="primary" eyebrow="La réalité">
                <ul className="space-y-1">
                  <li>· une équipe, dans un open-space</li>
                  <li>· beaucoup de doc, beaucoup de Slack, beaucoup de café</li>
                  <li>· une investigation prend des jours, pas 12 secondes</li>
                  <li>
                    · 80% du métier c'est la <em>défense</em>, pas l'attaque
                  </li>
                </ul>
              </Card>
            </CardGrid>
            <p>
              La cyber ce n'est pas un sport individuel ni un cliché de hacker. C'est une discipline
              d'ingénierie + de communication + de veille permanente.
            </p>
          </Section>

          <Section index="02" title="Les 3 grandes familles de métiers">
            <CardGrid cols={3}>
              <Card icon="🛡️" title="Blue team — défense">
                Surveiller, détecter, contenir, remédier. Les analystes SOC, les ingés sécurité, les
                experts forensic. Le quotidien : lire des logs, écrire des règles de détection,
                répondre aux incidents.
              </Card>
              <Card icon="⚔️" title="Red team — attaque éthique">
                Pentesteurs, bug bounty hunters, chercheurs en vulnérabilités. Ils cherchent les
                failles <em>avant</em> les vrais attaquants, sur autorisation explicite, et rendent
                un rapport. C'est le métier qui ressemble le plus au cliché — mais en mode pro et
                légal.
              </Card>
              <Card icon="📋" title="Gouvernance · GRC">
                RSSI, consultants conformité, juristes cyber. Ils écrivent les politiques, gèrent
                les risques, négocient avec la direction et les régulateurs (RGPD, NIS2…). Moins
                technique, plus stratégique. Salaires souvent très bons.
              </Card>
            </CardGrid>
          </Section>

          <Section index="03" title="Une journée type d'analyste SOC">
            <Timeline rows={journee} />
            <p>
              Spoiler : pas mal d'écrits, pas mal de lecture, beaucoup d'investigation. C'est un
              métier d'enquêteur·rice plus que de pirate.
            </p>
          </Section>

          <Section index="04" title="Pourquoi c'est intéressant en 2026">
            <CardGrid cols={2}>
              {arguments2026.map((a) => (
                <Card key={a.eyebrow} eyebrow={a.eyebrow}>
                  {a.text}
                </Card>
              ))}
            </CardGrid>
          </Section>

          <Section index="05" title="« Mais c'est dur, non ? »">
            <Card tone="primary">
              <p className="text-foreground/90">
                Honnêtement : c'est <strong>technique mais progressif</strong>. Personne ne naît
                avec ces compétences. Les gens qui réussissent ont juste un truc en commun : ils ont
                accepté de <em>ne pas tout comprendre</em> tout de suite, et de creuser quand ils
                butent.
              </p>
              <p className="mt-3">
                Tu peux démarrer maintenant, gratuitement, sans rien installer :
              </p>
              <ul className="mt-2 space-y-1">
                {ressources.map((r) => (
                  <li key={r.href}>
                    ·{' '}
                    <a
                      className="text-primary underline underline-offset-4"
                      href={r.href}
                      target="_blank"
                      rel="noreferrer"
                    >
                      {r.label}
                    </a>{' '}
                    — {r.desc}
                  </li>
                ))}
              </ul>
              <p className="mt-3">
                Vraiment : essaie 2-3 challenges débutants ce week-end. Si ça te gratte, c'est ton
                truc.
              </p>
            </Card>
          </Section>
        </Prose>

        <CtaRow>
          <Link
            href="/metiers"
            className="rounded-md bg-primary px-5 py-2.5 font-mono text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/80"
          >
            Voir les fiches métiers →
          </Link>
          <Link
            href="/comment-ca-marche/xss-attaque"
            className="rounded-md border border-border px-5 py-2.5 font-mono text-sm text-foreground transition-colors hover:border-primary hover:text-primary"
          >
            Voir une attaque en anim
          </Link>
        </CtaRow>
      </div>
    </>
  )
}
