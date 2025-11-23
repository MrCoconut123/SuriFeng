import pygame

pygame.init()
screen = pygame.display.set_mode((500, 300))
clock = pygame.time.Clock()

BPM = 60                   # beats per minute
BEAT_MS = 60000 // BPM    # ms between beats
HIT_WINDOW = 150          # how close to beat = GOOD

last_beat = pygame.time.get_ticks()
feedback = ""

running = True
while running:
    now = pygame.time.get_ticks()

    # ---- HANDLE EVENTS ----
    for event in pygame.event.get():
        if event.type == pygame.QUIT:
            running = False

        if event.type == pygame.KEYDOWN and event.key == pygame.K_SPACE:
            time_since = now - last_beat
            if 0 <= time_since <= HIT_WINDOW:
                feedback = "GOOD!"
            else:
                feedback = "MISS"

    # ---- UPDATE BEAT ----
    if now - last_beat >= BEAT_MS:
        last_beat += BEAT_MS

    # ---- DRAW ----
    screen.fill((20, 20, 50))

    # circle flashes ON BEAT
    time_since = now - last_beat
    if 0 <= time_since <= 150:
        color = (255, 255, 255)   # bright
    else:
        color = (120, 120, 120)   # dim

    pygame.draw.circle(screen, color, (250, 150), 40)

    # draw feedback text
    font = pygame.font.Font(None, 48)
    text = font.render(feedback, True, (255, 255, 255))
    screen.blit(text, (20, 20))

    pygame.display.flip()
    clock.tick(60)

pygame.quit()
