/**
 * v0.7.18 — Яндекс.Диск интеграция
 * Загрузка фотоотчётов в облачное хранилище
 */

const YandexDisk = {
  API_BASE: 'https://cloud-api.yandex.net/v1/disk/',
  
  /**
   * Получить OAuth токен из настроек
   */
  getToken() {
    return settings.yandexDiskToken || '';
  },
  
  /**
   * Проверить валидность токена
   */
  async validateToken(token) {
    if (!token) return false;
    
    try {
      const response = await fetch(`${this.API_BASE}`, {
        headers: {
          'Authorization': `OAuth ${token}`
        }
      });
      
      return response.status === 200;
    } catch (error) {
      console.error('YandexDisk validateToken error:', error);
      return false;
    }
  },
  
  /**
   * Создать папку на Диске
   */
  async createFolder(path, token) {
    if (!token) token = this.getToken();
    
    try {
      const response = await fetch(`${this.API_BASE}resources`, {
        method: 'PUT',
        headers: {
          'Authorization': `OAuth ${token}`
        },
        body: JSON.stringify({
          path: path
        })
      });
      
      if (response.status === 201 || response.status === 409) {
        // 201 = создана, 409 = уже существует
        return { success: true, path };
      }
      
      return { success: false, error: `HTTP ${response.status}` };
    } catch (error) {
      console.error('YandexDisk createFolder error:', error);
      return { success: false, error: error.message };
    }
  },
  
  /**
   * Получить URL для загрузки файла
   */
  async getUploadUrl(path, token) {
    if (!token) token = this.getToken();
    
    try {
      const response = await fetch(
        `${this.API_BASE}resources/upload?path=${encodeURIComponent(path)}&overwrite=true`,
        {
          headers: {
            'Authorization': `OAuth ${token}`
          }
        }
      );
      
      if (response.status === 200) {
        const data = await response.json();
        return { success: true, href: data.href };
      }
      
      return { success: false, error: `HTTP ${response.status}` };
    } catch (error) {
      console.error('YandexDisk getUploadUrl error:', error);
      return { success: false, error: error.message };
    }
  },
  
  /**
   * Загрузить файл на Диск
   */
  async uploadFile(blob, path, token) {
    if (!token) token = this.getToken();
    
    try {
      // 1. Получить URL для загрузки
      const uploadUrlResult = await this.getUploadUrl(path, token);
      if (!uploadUrlResult.success) {
        return uploadUrlResult;
      }
      
      // 2. Загрузить файл
      const response = await fetch(uploadUrlResult.href, {
        method: 'PUT',
        headers: {
          'Content-Type': blob.type
        },
        body: blob
      });
      
      if (response.status === 201 || response.status === 202) {
        return { success: true, path };
      }
      
      return { success: false, error: `HTTP ${response.status}` };
    } catch (error) {
      console.error('YandexDisk uploadFile error:', error);
      return { success: false, error: error.message };
    }
  },
  
  /**
   * Получить публичную ссылку на файл
   */
  async getPublicLink(path, token) {
    if (!token) token = this.getToken();
    
    try {
      // Публикуем ресурс
      const pubResponse = await fetch(
        `${this.API_BASE}resources/publish?path=${encodeURIComponent(path)}`,
        {
          method: 'PUT',
          headers: {
            'Authorization': `OAuth ${token}`
          }
        }
      );
      
      if (pubResponse.status !== 200) {
        return { success: false, error: `Publish failed: HTTP ${pubResponse.status}` };
      }
      
      // Получаем метаинформацию с публичной ссылкой
      const metaResponse = await fetch(
        `${this.API_BASE}resources?path=${encodeURIComponent(path)}`,
        {
          headers: {
            'Authorization': `OAuth ${token}`
          }
        }
      );
      
      if (metaResponse.status === 200) {
        const data = await metaResponse.json();
        return { success: true, publicUrl: data.public_url };
      }
      
      return { success: false, error: `HTTP ${metaResponse.status}` };
    } catch (error) {
      console.error('YandexDisk getPublicLink error:', error);
      return { success: false, error: error.message };
    }
  },
  
  /**
   * Удалить файл с Диска
   */
  async deleteFile(path, token, permanently = false) {
    if (!token) token = this.getToken();
    
    try {
      const response = await fetch(
        `${this.API_BASE}resources?path=${encodeURIComponent(path)}&permanently=${permanently}`,
        {
          method: 'DELETE',
          headers: {
            'Authorization': `OAuth ${token}`
          }
        }
      );
      
      if (response.status === 204) {
        return { success: true };
      }
      
      return { success: false, error: `HTTP ${response.status}` };
    } catch (error) {
      console.error('YandexDisk deleteFile error:', error);
      return { success: false, error: error.message };
    }
  }
};

// Экспорт для использования в других модулях
window.YandexDisk = YandexDisk;
