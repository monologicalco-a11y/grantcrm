"use client";

import Link from "next/link";
import Image from "next/image";
import {
  ArrowRight,
  Sparkles,
  Users,
  Zap,
  Phone,
  Mail,
  BarChart3,
  Shield,
  CheckCircle2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { LandingNav } from "@/components/landing/nav";
import { ClientMotionSSR as ClientMotion } from "@/components/landing/client-motion-ssr";

const features = [
  {
    icon: Users,
    title: "Contact Management",
    description:
      "Organize and segment your contacts with custom fields, tags, and AI-powered lead scoring.",
  },
  {
    icon: BarChart3,
    title: "Visual Pipeline",
    description:
      "Track deals through customizable Kanban boards with forecasting and probability insights.",
  },
  {
    icon: Phone,
    title: "Built-in Calling",
    description:
      "Make and receive calls directly from your browser with WebRTC and SIP integration.",
  },
  {
    icon: Mail,
    title: "Email Sequences",
    description:
      "Automate follow-ups with drip campaigns, templates, and A/B testing capabilities.",
  },
  {
    icon: Zap,
    title: "Workflow Automation",
    description:
      "Build powerful automations with our visual no-code builder. Trigger actions on any event.",
  },
  {
    icon: Sparkles,
    title: "AI Intelligence",
    description:
      "Smart summaries, predictive scoring, and an AI copilot to help you close more deals.",
  },
];

const testimonials = [
  {
    quote:
      "NanoSol CRM transformed how we manage our sales pipeline. The AI features alone save us hours every week.",
    author: "Sarah Chen",
    role: "VP of Sales, TechCorp",
  },
  {
    quote:
      "The built-in calling and email sequences are game-changers. We've increased our response rate by 40%.",
    author: "Michael Torres",
    role: "Sales Director, GrowthCo",
  },
];

export default function LandingPageContent() {
  return (
    <div className="min-h-screen bg-background" suppressHydrationWarning>
      <LandingNav />

      {/* Hero Section */}
      <section className="pt-32 pb-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <ClientMotion
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="text-center max-w-4xl mx-auto"
          >
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-primary/10 text-primary text-sm font-medium mb-6">
              <Sparkles className="h-4 w-4" />
              AI-Powered CRM for Modern Teams
            </div>
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight mb-6">
              The CRM that
              <span className="text-primary"> closes deals</span> while you
              sleep
            </h1>
            <p className="text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">
              Manage contacts, automate workflows, and leverage AI to boost your
              sales. All in one beautiful, powerful platform.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button size="lg" className="w-full sm:w-auto" asChild>
                <Link href="/signup">
                  Start Free Trial
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
              <Button size="lg" variant="outline" className="w-full sm:w-auto" asChild>
                <Link href="#features">
                  See Features
                </Link>
              </Button>
            </div>
            <div className="mt-8 flex items-center justify-center gap-6 text-sm text-muted-foreground">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-green-500" />
                No credit card required
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-green-500" />
                14-day free trial
              </div>
              <div className="flex items-center gap-2">
                <Shield className="h-4 w-4 text-green-500" />
                SOC 2 Compliant
              </div>
            </div>
          </ClientMotion>

          {/* Hero Image */}
          <ClientMotion
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.2 }}
            className="mt-16"
          >
            <div className="relative rounded-xl bg-gradient-to-br from-primary/20 via-primary/10 to-transparent p-1">
              <div className="rounded-lg bg-card border shadow-2xl overflow-hidden">
                <Image
                  src="/dashboard-preview.png"
                  alt="NanoSol CRM Dashboard Preview"
                  width={1200}
                  height={675}
                  priority
                  className="w-full h-auto object-cover"
                />
              </div>
            </div>
          </ClientMotion>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-20 px-4 sm:px-6 lg:px-8 bg-muted/30">
        <div className="max-w-7xl mx-auto">
          <ClientMotion
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <h2 className="text-3xl sm:text-4xl font-bold mb-4">
              Everything you need to
              <span className="text-primary"> grow revenue</span>
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              A complete suite of tools to manage your entire sales process from
              first touch to closed deal.
            </p>
          </ClientMotion>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((feature, index) => (
              <ClientMotion
                key={feature.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.1 }}
              >
                <Card className="h-full hover:shadow-lg transition-shadow">
                  <CardContent className="p-6">
                    <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10 mb-4">
                      <feature.icon className="h-6 w-6 text-primary" />
                    </div>
                    <h3 className="text-lg font-semibold mb-2">
                      {feature.title}
                    </h3>
                    <p className="text-muted-foreground">
                      {feature.description}
                    </p>
                  </CardContent>
                </Card>
              </ClientMotion>
            ))}
          </div>
        </div>
      </section>

      {/* Testimonials Section */}
      <section id="testimonials" className="py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <ClientMotion
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <h2 className="text-3xl sm:text-4xl font-bold mb-4">
              Loved by sales teams
              <span className="text-primary"> worldwide</span>
            </h2>
          </ClientMotion>

          <div className="grid md:grid-cols-2 gap-8">
            {testimonials.map((testimonial, index) => (
              <ClientMotion
                key={testimonial.author}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.1 }}
              >
                <Card className="h-full">
                  <CardContent className="p-8">
                    <p className="text-lg mb-6">&ldquo;{testimonial.quote}&rdquo;</p>
                    <div>
                      <p className="font-semibold">{testimonial.author}</p>
                      <p className="text-sm text-muted-foreground">
                        {testimonial.role}
                      </p>
                    </div>
                  </CardContent>
                </Card>
              </ClientMotion>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 bg-primary/5">
        <div className="max-w-4xl mx-auto text-center">
          <ClientMotion
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <h2 className="text-3xl sm:text-4xl font-bold mb-4">
              Ready to supercharge your sales?
            </h2>
            <p className="text-lg text-muted-foreground mb-8">
              Join thousands of teams already using NanoSol CRM to close more
              deals.
            </p>
            <Button size="lg" asChild>
              <Link href="/signup">
                Start Your Free Trial
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </ClientMotion>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 px-4 sm:px-6 lg:px-8 border-t">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <div className="flex items-center gap-2">
              <div className="flex h-6 w-6 items-center justify-center rounded bg-primary">
                <Sparkles className="h-4 w-4 text-primary-foreground" />
              </div>
              <span className="font-semibold">NanoSol CRM</span>
            </div>
            <p className="text-sm text-muted-foreground">
              © 2026 NanoSol CRM. All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
