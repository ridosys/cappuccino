
-- CreateTable
CREATE TABLE "PosRegister" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "customerId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PosRegister_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "_AdminToPosRegister" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_AdminToPosRegister_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateTable
CREATE TABLE "_CategoryToPosRegister" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_CategoryToPosRegister_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE INDEX "PosRegister_customerId_idx" ON "PosRegister"("customerId");

-- CreateIndex
CREATE INDEX "_AdminToPosRegister_B_index" ON "_AdminToPosRegister"("B");

-- CreateIndex
CREATE INDEX "_CategoryToPosRegister_B_index" ON "_CategoryToPosRegister"("B");

-- AddForeignKey
ALTER TABLE "PosRegister" ADD CONSTRAINT "PosRegister_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_AdminToPosRegister" ADD CONSTRAINT "_AdminToPosRegister_A_fkey" FOREIGN KEY ("A") REFERENCES "Admin"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_AdminToPosRegister" ADD CONSTRAINT "_AdminToPosRegister_B_fkey" FOREIGN KEY ("B") REFERENCES "PosRegister"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_CategoryToPosRegister" ADD CONSTRAINT "_CategoryToPosRegister_A_fkey" FOREIGN KEY ("A") REFERENCES "Category"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_CategoryToPosRegister" ADD CONSTRAINT "_CategoryToPosRegister_B_fkey" FOREIGN KEY ("B") REFERENCES "PosRegister"("id") ON DELETE CASCADE ON UPDATE CASCADE;

