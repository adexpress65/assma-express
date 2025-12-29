const { withAndroidPermissions } = require('@expo/config-plugins');

const withAgora = (config) => {
  // Ajouter les permissions Android
  config = withAndroidPermissions(config, (permissions) => {
    permissions.push(
      'android.permission.CAMERA',
      'android.permission.RECORD_AUDIO',
      'android.permission.ACCESS_NETWORK_STATE',
      'android.permission.MODIFY_AUDIO_SETTINGS',
      'android.permission.BLUETOOTH'
    );
    return permissions;
  });

  return config;
};

module.exports = withAgora;