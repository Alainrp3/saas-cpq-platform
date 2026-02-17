# SaaS CPQ Platform

## Overview

I am building this SaaS CPQ platform to model real-world pricing challenges in service-based industries.

With 15+ years in the environmental services industry working on pricing, margin analysis, and complex quoting systems, I’ve seen firsthand how many organizations still rely on spreadsheets and fragmented tools.

This platform is my attempt to design a modern, cloud-native solution that combines structured pricing logic, flexibility for varied job formats, and the speed required for high-volume quoting environments.

The long-term goal is to deploy this as a fully containerized, infrastructure-as-code-driven SaaS platform on AWS, demonstrating both domain expertise in pricing strategy and modern cloud engineering practices.

The objective is to:

- Model structured pricing logic
- Generate quotes programmatically
- Deploy infrastructure using Infrastructure as Code
- Integrate AI-assisted pricing logic
- Demonstrate production-grade cloud engineering practices

---

## Current Architecture

Express API (Node.js)
↓
PostgreSQL (Docker)
↓
Docker Compose orchestration

---

## Tech Stack

- Node.js (Express)
- PostgreSQL
- Docker / Docker Compose
- Git / GitHub
- AWS (planned)
- Terraform (planned)

---

## Local Development

### Start Services

From repository root:

docker compose up --build

### Health Check

http://localhost:3001/health

### Database Health

http://localhost:3001/db-health

---

## Repository Structure

apps/
  api/          → Express backend
  web/          → Future React frontend
infra/          → Terraform (planned)
packages/       → Shared modules (future)
docs/           → Documentation

---

## Roadmap

- Add PostgreSQL schema
- Implement CPQ data models
- Add pricing engine
- Add authentication
- Add frontend
- Deploy to AWS with Terraform
- Implement CI/CD
- Integrate AI pricing logic
