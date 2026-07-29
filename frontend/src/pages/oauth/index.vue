<script setup lang="ts">
import { ref } from "vue";
import { useRouter } from "vue-router";
import { beginOAuthLogin } from "@/services/auth";
import { isWails } from "@/services/platform";
import { useNotificationStore } from "@/stores/notification";
import { Button } from "@kousum/semi-ui-vue";
import { IconArrowRight } from "@kousum/semi-icons-vue";

defineOptions({
  name: "OAuthPage",
});

const router = useRouter();
const notificationStore = useNotificationStore();

const isLoading = ref(false);

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
  isLoading.value = true;
  try {
    const ok = await beginOAuthLogin();

    if (!ok) {
      throw new Error("OAuth 授权失败，请重试。");
    }

    if (isWails()) {
      notificationStore.success("登录成功，正在跳转...");
      await router.replace("/");
    }
  } catch (error) {
    notificationStore.error(parseError(error));
  } finally {
    isLoading.value = false;
  }
}
</script>

<template>
  <div class="oauth-container">
    <div class="oauth-content">
      <div class="oauth-visual">
        <img src="/imgs/yuzu_happy.png" alt="Lolia Shizuku" />
      </div>
      <div class="oauth-copy">
        <span class="oauth-kicker">LOLiA FRP CLIENT</span>
        <h1>Lolia Shizuku</h1>
        <p>登录后管理隧道、流量与服务器上的 frpc Runner。</p>
      </div>
      <Button
        class="login-button"
        :loading="isLoading"
        size="large"
        theme="solid"
        type="primary"
        block
        @click="handleLogin"
      >
        使用 Lolia FRP 账号登录
        <IconArrowRight v-if="!isLoading" style="font-size: 17px" />
      </Button>
      <small>Authorization Code + PKCE</small>
    </div>
  </div>
</template>

<style scoped>
.oauth-container {
  min-height: calc(100vh - 106px);
  display: flex;
  align-items: center;
  justify-content: center;
}

.oauth-content {
  width: 100%;
  max-width: 420px;
  display: flex;
  flex-direction: column;
  gap: 18px;
  text-align: center;
}
.oauth-visual { height: 170px; overflow: hidden; }
.oauth-visual img { width: 170px; height: 170px; object-fit: contain; }
.oauth-copy { display: flex; flex-direction: column; gap: 8px; }
.oauth-kicker { color: var(--app-accent); font-size: 11px; font-weight: 700; letter-spacing: 1.4px; }
.oauth-copy h1 { margin: 0; color: var(--app-text-strong); font: 700 30px/1.2 "Comfortaa", sans-serif; letter-spacing: 0; }
.oauth-copy p { margin: 0; color: var(--app-text); font-size: 14px; line-height: 1.7; }
.login-button { width: 100%; }
.login-button :deep(.semi-button-content) { display: flex; align-items: center; justify-content: center; gap: 8px; }
.oauth-content small { color: var(--app-text); font: 11px/1.4 ui-monospace, monospace; }
</style>
