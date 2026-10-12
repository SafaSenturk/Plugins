using System;
using UnityEngine;
#if ENABLE_INPUT_SYSTEM
using UnityEngine.InputSystem;
#endif

// BİRİNCİ ŞAHIS OYUNCU KONTROLÜ — WASD yürüme, Shift koşma, Space zıplama,
// fareyle bakış. SupermarketOyunu'ndan çıkarıldı; oyuna özel sınıflara
// bağlı değil. CharacterController gerektirir (eklenince kendisi gelir).
//
//   OyuncuKontrol.Engel = () => envanterAcik;     // true iken bakış ve hareket durur
//   oyuncu.hizCarpani = 1.2f;                      // yetenek/iksir
//   oyuncu.ziplamaAcik = false;                    // Space başka işe yarıyorsa
[RequireComponent(typeof(CharacterController))]
public class OyuncuKontrol : MonoBehaviour
{
    [Header("Hareket")]
    public float yurumeHizi = 4f;
    public float kosmaHizi = 7f;      // Shift basılıyken
    public float ziplamaGucu = 4.5f;
    public float yercekimi = -9.81f;
    public bool ziplamaAcik = true;
    [Tooltip("Yetenek, iksir, yük gibi etkiler için hız çarpanı")]
    public float hizCarpani = 1f;

    [Header("Fare ile Bakış")]
    public float fareHassasiyeti = 0.1f;   // Input System'de piksel başına derece
    public bool eksenTers = false;
    public Transform kamera;               // boşsa alt nesnelerdeki kamera bulunur

    /// <summary>true döndürdüğü sürece bakış ve hareket işlenmez (menü, envanter, sinematik…).
    /// Oyun duraklatıldığında (timeScale = 0) zaten durur.</summary>
    public static Func<bool> Engel;
    /// <summary>true döndürdüğü sürece bakış serbest ama yürüme kapalı (ör. diyalog).</summary>
    public static Func<bool> HareketEngeli;

    CharacterController denetleyici;
    float dikeyHiz;
    float bakisAcisiX;

    void Start()
    {
        denetleyici = GetComponent<CharacterController>();
        if (kamera == null)
        {
            Camera altKamera = GetComponentInChildren<Camera>();
            if (altKamera != null) kamera = altKamera.transform;
        }
        Cursor.lockState = CursorLockMode.Locked;
        Cursor.visible = false;
    }

    void Update()
    {
        if (Time.timeScale == 0f) return;
        if (Engel != null && Engel()) return;

        Bakis();
        if (HareketEngeli != null && HareketEngeli()) return;
        Hareket();
    }

    void Bakis()
    {
#if ENABLE_INPUT_SYSTEM
        Vector2 fareDelta = Mouse.current != null ? Mouse.current.delta.ReadValue() * fareHassasiyeti : Vector2.zero;
#else
        Vector2 fareDelta = new Vector2(Input.GetAxis("Mouse X"), Input.GetAxis("Mouse Y")) * (fareHassasiyeti * 20f);
#endif
        transform.Rotate(Vector3.up * fareDelta.x);                 // sağa-sola: gövde döner
        bakisAcisiX += eksenTers ? fareDelta.y : -fareDelta.y;      // yukarı-aşağı: yalnızca kamera
        bakisAcisiX = Mathf.Clamp(bakisAcisiX, -85f, 85f);
        if (kamera != null) kamera.localRotation = Quaternion.Euler(bakisAcisiX, 0f, 0f);
    }

    void Hareket()
    {
        float yatay = 0f, dikey = 0f;
        bool kos, zipla;
#if ENABLE_INPUT_SYSTEM
        Keyboard k = Keyboard.current;
        if (k == null) return;
        if (k.aKey.isPressed) yatay -= 1f;
        if (k.dKey.isPressed) yatay += 1f;
        if (k.sKey.isPressed) dikey -= 1f;
        if (k.wKey.isPressed) dikey += 1f;
        kos = k.leftShiftKey.isPressed;
        zipla = k.spaceKey.wasPressedThisFrame;
#else
        yatay = Input.GetAxisRaw("Horizontal");
        dikey = Input.GetAxisRaw("Vertical");
        kos = Input.GetKey(KeyCode.LeftShift);
        zipla = Input.GetKeyDown(KeyCode.Space);
#endif
        float hiz = (kos ? kosmaHizi : yurumeHizi) * hizCarpani;
        Vector3 yon = Vector3.ClampMagnitude(transform.right * yatay + transform.forward * dikey, 1f);

        if (denetleyici.isGrounded && dikeyHiz < 0f) dikeyHiz = -2f;   // yere yapışık kalsın
        if (ziplamaAcik && denetleyici.isGrounded && zipla) dikeyHiz = ziplamaGucu;
        dikeyHiz += yercekimi * Time.deltaTime;

        denetleyici.Move((yon * hiz + Vector3.up * dikeyHiz) * Time.deltaTime);
    }
}
