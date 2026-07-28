<script setup lang="ts">
import { ref } from "vue";
import { useRouter } from "vue-router";
import { beginOAuthLogin } from "@/services/auth";
import { isWails } from "@/services/platform";

defineOptions({
  name: "OAuthPage",
});

const router = useRouter();

const isLoading = ref(false);
const errorMessage = ref("");
const successMessage = ref("");

function parseError(error: unknown): string {
  if (typeof error === "string" && error.trim()) {
    return error;
  }

  if (error instanceof Error && error.message) {
    return error.message;
  }

  if (
    typeof error === "object" &&
    error !== null &&
    "message" in error &&
    typeof (error as { message?: unknown }).message === "string"
  ) {
    return (error as { message: string }).message;
  }

  return "OAuth 登录失败，请稍后重试。";
}

async function handleLogin() {
  errorMessage.value = "";
  successMessage.value = "";

  isLoading.value = true;
  try {
    const ok = await beginOAuthLogin();

    if (!ok) {
      throw new Error("OAuth 授权失败，请重试。");
    }

    if (isWails()) {
      successMessage.value = "登录成功，正在跳转...";
      await router.replace("/");
    }
  } catch (error) {
    errorMessage.value = parseError(error);
  } finally {
    isLoading.value = false;
  }
}
</script>

<template>
  <v-container class="oauth-container">
    <div class="oauth-content">
      <!-- Logo Image -->
      <div class="text-center mb-2">
        <v-img
          src="./imgs/yuzu_happy.png"
          alt="Lolia Shizuku"
          max-width="150"
          class="mx-auto"
        />
      </div>

      <!-- Logo / Title -->
      <div class="text-center mb-7">
        <h1 class="text-h4 font-weight-bold mb-2">Lolia Shizuku</h1>
        <p class="text-subtitle-1">
          「ロリア・雫」由 Wails 驱动的 Lolia FRP 第三方客户端
        </p>
      </div>

      <v-alert v-if="errorMessage" type="error" variant="tonal" class="mb-4">
        {{ errorMessage }}
      </v-alert>

      <v-alert
        v-if="successMessage"
        type="success"
        variant="tonal"
        class="mb-4"
      >
        {{ successMessage }}
      </v-alert>

      <!-- Login Button -->
      <v-btn
        :loading="isLoading"
        color="primary"
        size="large"
        block
        @click="handleLogin"
      >
        <v-icon v-if="!isLoading" start>fas fa-arrow-right-long</v-icon>
        使用 Lolia FRP 账号登录
      </v-btn>
    </div>
  </v-container>
</template>

<style scoped>
.oauth-container {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1rem;
}

.oauth-content {
  width: 100%;
  max-width: 400px;
}
</style>
