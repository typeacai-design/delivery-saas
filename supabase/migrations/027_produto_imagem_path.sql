-- Migration 027: coluna imagem_path em produtos (pra deletar do storage)
ALTER TABLE produtos ADD COLUMN IF NOT EXISTS imagem_path TEXT;
