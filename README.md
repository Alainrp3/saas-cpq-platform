# SaaS CPQ Platform

## Overview

This project is a cloud-native SaaS CPQ (Configure, Price, Quote) platform built using modern containerized architecture.

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
