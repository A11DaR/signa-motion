# Публикация SIGNA

## Что публиковать

Публичный репозиторий должен содержать текущие исходники **и существующую историю Git**. Не создавайте репозиторий загрузкой одних файлов через браузер, если это потеряет историю. Не меняйте даты старых коммитов.

Каталог публикации сайта — `dist/`. Перед публикацией выполните `npm run build`; workflow делает это через `npm run check`. Для камеры нужен HTTPS либо localhost.

## GitHub

После подключения авторизованного GitHub создайте пустой публичный репозиторий `signa-motion` в аккаунте команды. Не добавляйте в него отдельный стартовый README, чтобы не создавать конфликтующую историю. Если имя занято, выберите другое свободное имя.

Из подготовленного Git-репозитория отправляется текущая ветка в `main`. Например, после установки GitHub CLI и входа в аккаунт:

```bash
gh repo create signa-motion --public --source=. --remote=github --description "SIGNA: browser ASL trainer for ADMIT Hackathon"
git push -u github HEAD:main
```

Команды не содержат токенов. Если репозиторий уже существует, не запускайте создание повторно: добавьте его реальный адрес как remote `github` и отправьте текущую ветку. Не используйте force-push.

## Восстановление из комплекта

Если получен архив с `signa-history.bundle`, полная история восстанавливается так:

```bash
git clone -b submission/github signa-history.bundle SIGNA
git -C SIGNA branch -m main
git -C SIGNA remote remove origin
cd SIGNA
npm start
```

Эти команды создают новую рабочую папку `SIGNA`; перед выполнением она не должна существовать. Обычный каталог `source/` в комплекте содержит те же текущие файлы для быстрого просмотра, но история хранится в bundle.

## GitHub Pages

1. В публичном репозитории открыть **Settings → Pages → Build and deployment → Source → GitHub Actions**.
2. В **Actions** запустить **Publish SIGNA to GitHub Pages** либо отправить следующий коммит в `main`.
3. Workflow проверит код и тесты, затем опубликует `dist/`.
4. Скопировать фактически выданную ссылку в README, `HACKATHON.md` и форму сдачи.
5. Открыть её в приватном окне и проверить разрешение камеры, весь урок и результат.

До настройки Pages первый запуск публикации может завершиться ошибкой настройки. Независимая проверка `Validate SIGNA` работает без включения Pages. Наличие YAML не означает успешный запуск GitHub Actions: результат проверяется после настоящей публикации.

Официальные инструкции:

- https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages
- https://github.com/actions/setup-node
