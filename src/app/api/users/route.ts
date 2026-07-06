import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// GET /api/users - 用户列表
export async function GET() {
  try {
    const users = await prisma.user.findMany({
      where: { disabled: false },
      select: { id: true, name: true, role: true, warehouse: true },
      orderBy: { name: "asc" },
    });
    return NextResponse.json({ success: true, data: users });
  } catch (error) {
    console.error("[GET /api/users]", error);
    return NextResponse.json({ success: false, error: "查询用户失败" }, { status: 500 });
  }
}
